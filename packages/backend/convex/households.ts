import { ConvexError, v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { type MutationCtx, mutation } from "./_generated/server";
import { requireHousehold, requireInvite } from "./invites/access";
import { householdCode } from "./invites/codes";
import { cleanHousehold, cleanReply, MAX_HOUSEHOLDS } from "./invites/rules";
import {
  channelValidator,
  householdInputValidator,
  type Reply,
  replyInputValidator,
} from "./invites/validators";
import { errors } from "./utils/errors";

/**
 * The couple's guest list: the families their digital invitation goes to,
 * each with its own link, and the replies the couple takes themselves, such
 * as one given on the phone.
 */

/** Families added at once, as from a pasted list. */
const MAX_ADDED = 200;

/** A code no other family of the invitation has. */
async function freeCode(ctx: MutationCtx, inviteId: Id<"invites">) {
  for (;;) {
    const code = householdCode();
    const taken = await ctx.db
      .query("households")
      .withIndex("by_inviteId_and_code", (q) =>
        q.eq("inviteId", inviteId).eq("code", code),
      )
      .first();
    if (!taken) return code;
  }
}

/** Whether the invitation has room for `count` more families. */
async function hasRoom(
  ctx: MutationCtx,
  invite: Doc<"invites">,
  count: number,
) {
  const kept = await ctx.db
    .query("households")
    .withIndex("by_inviteId", (q) => q.eq("inviteId", invite._id))
    .take(MAX_HOUSEHOLDS);
  return kept.length + count <= MAX_HOUSEHOLDS;
}

/**
 * Keeps a reply on its family and in the invitation's history. One without
 * allergies takes them out of the family's earlier replies too: that's how
 * a guest takes back what they wrote, as the privacy policy says.
 */
export async function saveReply(
  ctx: MutationCtx,
  household: Doc<"households">,
  reply: Reply,
) {
  await ctx.db.patch("households", household._id, {
    reply,
    updatedAt: reply.at,
  });
  if (reply.allergies === undefined) {
    const earlier = await ctx.db
      .query("replies")
      .withIndex("by_householdId", (q) => q.eq("householdId", household._id))
      .take(500);
    for (const entry of earlier) {
      if (entry.reply.allergies === undefined) continue;
      const { allergies: _, ...rest } = entry.reply;
      await ctx.db.patch("replies", entry._id, { reply: rest });
    }
  }
  await ctx.db.insert("replies", {
    inviteId: household.inviteId,
    householdId: household._id,
    reply,
  });
}

/** Adds families to the guest list, each with a link of its own. */
export const add = mutation({
  args: {
    inviteId: v.id("invites"),
    households: v.array(householdInputValidator),
  },
  returns: v.array(v.id("households")),
  handler: async (ctx, args) => {
    const { invite } = await requireInvite(ctx, args.inviteId);
    if (args.households.length > MAX_ADDED)
      throw new ConvexError(errors.invalidInput);
    if (!(await hasRoom(ctx, invite, args.households.length)))
      throw new ConvexError(errors.tooManyHouseholds);
    const now = Date.now();
    const ids = [];
    for (const input of args.households) {
      ids.push(
        await ctx.db.insert("households", {
          inviteId: invite._id,
          ...cleanHousehold(input),
          code: await freeCode(ctx, invite._id),
          source: "couple",
          updatedAt: now,
        }),
      );
    }
    return ids;
  },
});

/** Changes a family's details; their link stays the same. */
export const update = mutation({
  args: { householdId: v.id("households"), household: householdInputValidator },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { household } = await requireHousehold(ctx, args.householdId);
    const cleaned = cleanHousehold(args.household);
    await ctx.db.replace("households", household._id, {
      inviteId: household.inviteId,
      code: household.code,
      source: household.source,
      ...cleaned,
      sent: household.sent,
      emailed: household.emailed,
      openedAt: household.openedAt,
      reply: household.reply,
      updatedAt: Date.now(),
    });
    return null;
  },
});

/** Takes a family off the guest list, with their replies; their link stops working. */
export const remove = mutation({
  args: { householdId: v.id("households") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { household } = await requireHousehold(ctx, args.householdId);
    const replies = await ctx.db
      .query("replies")
      .withIndex("by_householdId", (q) => q.eq("householdId", household._id))
      .take(500);
    for (const reply of replies) await ctx.db.delete("replies", reply._id);
    const emails = await ctx.db
      .query("inviteEmails")
      .withIndex("by_householdId", (q) => q.eq("householdId", household._id))
      .take(500);
    for (const email of emails) await ctx.db.delete("inviteEmails", email._id);
    await ctx.db.delete("households", household._id);
    return null;
  },
});

/**
 * Notes that the couple sent a family their link: by WhatsApp or text from
 * their own phone, or copied to send another way.
 */
export const markSent = mutation({
  args: { householdId: v.id("households"), by: channelValidator },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { household } = await requireHousehold(ctx, args.householdId);
    const now = Date.now();
    await ctx.db.patch("households", household._id, {
      sent: { by: args.by, at: now },
      updatedAt: now,
    });
    return null;
  },
});

/**
 * Keeps a reply the couple took themselves, such as on the phone, as the
 * family's: it follows the same rules as one sent through their link, but
 * after the reply date too.
 */
export const takeReply = mutation({
  args: { householdId: v.id("households"), reply: replyInputValidator },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { household, invite } = await requireHousehold(ctx, args.householdId);
    const reply = cleanReply(
      args.reply,
      household,
      invite.questions,
      "couple",
      Date.now(),
    );
    await saveReply(ctx, household, reply);
    return null;
  },
});
