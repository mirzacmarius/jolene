import { v } from "convex/values";
import { internal } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";
import {
  internalMutation,
  type MutationCtx,
  type QueryCtx,
} from "../_generated/server";
import { guestListMonths } from "../workshop/settings";
import { romanianDate } from "./codes";

/**
 * Guest lists go once their event is long past (docs/adr/0017): the
 * families, every reply in their history and the emails of their
 * invitations, as many months after the event as the workshop sets
 * (convex/workshop/settings.ts). The invitation itself stays the couple's,
 * with its open link closed.
 */

/** Invitations one run looks at. */
const INVITES_PER_RUN = 100;

/** Documents one run deletes at most, well within what a mutation may write. */
const DELETES_PER_RUN = 1000;

const ISO_DAY = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * A day, YYYY-MM-DD, so many months on. A day the later month doesn't have
 * runs into the next, as 31 January and a month make 3 March.
 */
export function monthsAfter(day: string, months: number): string {
  const [, year, month, date] = ISO_DAY.exec(day) ?? [];
  return new Date(
    Date.UTC(Number(year), Number(month) - 1 + months, Number(date)),
  )
    .toISOString()
    .slice(0, 10);
}

/**
 * The last day an invitation's guest list is kept: so many months after its
 * event. An event without a date, or with one from before the invitation was
 * made, as a year typed wrong, counts from the latest the couple changed the
 * invitation, added a family or took a reply.
 */
export async function keptUntil(
  ctx: QueryCtx,
  invite: Doc<"invites">,
  months: number,
): Promise<string> {
  const event = await ctx.db.get("events", invite.eventId);
  const date = event?.fields.date?.trim();
  if (date && ISO_DAY.test(date) && date >= romanianDate(invite._creationTime))
    return monthsAfter(date, months);
  const family = await ctx.db
    .query("households")
    .withIndex("by_inviteId", (q) => q.eq("inviteId", invite._id))
    .order("desc")
    .first();
  const reply = await ctx.db
    .query("replies")
    .withIndex("by_inviteId", (q) => q.eq("inviteId", invite._id))
    .order("desc")
    .first();
  const changed = Math.max(
    invite.updatedAt,
    family?._creationTime ?? 0,
    reply?._creationTime ?? 0,
  );
  return monthsAfter(romanianDate(changed), months);
}

/**
 * Whether an invitation still holds guests, or an open link anyone could add
 * a family by, past the day its guest list is kept until.
 */
async function due(
  ctx: QueryCtx,
  invite: Doc<"invites">,
  months: number,
  today: string,
) {
  const holds =
    invite.open ||
    (await ctx.db
      .query("households")
      .withIndex("by_inviteId", (q) => q.eq("inviteId", invite._id))
      .first()) !== null ||
    (await ctx.db
      .query("replies")
      .withIndex("by_inviteId", (q) => q.eq("inviteId", invite._id))
      .first()) !== null;
  return holds && today > (await keptUntil(ctx, invite, months));
}

/**
 * Finds the guest lists kept long enough, a page of invitations at a time,
 * and deletes each in a run of its own. Runs daily.
 */
export const lists = internalMutation({
  args: { cursor: v.optional(v.string()) },
  returns: v.null(),
  handler: async (ctx, { cursor }) => {
    const months = await guestListMonths(ctx);
    const today = romanianDate(Date.now());
    const page = await ctx.db
      .query("invites")
      .paginate({ cursor: cursor ?? null, numItems: INVITES_PER_RUN });
    for (const invite of page.page)
      if (await due(ctx, invite, months, today))
        await ctx.scheduler.runAfter(0, internal.invites.forget.list, {
          inviteId: invite._id,
        });
    if (!page.isDone)
      await ctx.scheduler.runAfter(0, internal.invites.forget.lists, {
        cursor: page.continueCursor,
      });
    return null;
  },
});

/**
 * Deletes up to DELETES_PER_RUN of an invitation's guest list: its replies,
 * then each family after its emails. True once nothing is left.
 */
async function deleteSome(
  ctx: MutationCtx,
  inviteId: Id<"invites">,
): Promise<boolean> {
  let left = DELETES_PER_RUN;
  const replies = await ctx.db
    .query("replies")
    .withIndex("by_inviteId", (q) => q.eq("inviteId", inviteId))
    .take(left);
  for (const reply of replies) await ctx.db.delete("replies", reply._id);
  left -= replies.length;
  if (left === 0) return false;
  const families = await ctx.db
    .query("households")
    .withIndex("by_inviteId", (q) => q.eq("inviteId", inviteId))
    .take(left);
  for (const family of families) {
    const emails = await ctx.db
      .query("inviteEmails")
      .withIndex("by_householdId", (q) => q.eq("householdId", family._id))
      .take(left);
    for (const email of emails) await ctx.db.delete("inviteEmails", email._id);
    left -= emails.length;
    if (left === 0) return false;
    await ctx.db.delete("households", family._id);
    left -= 1;
    if (left === 0) return false;
  }
  return true;
}

/**
 * Deletes one invitation's guest list, if it's still due, a batch at a time,
 * then closes its open link so no one adds a family to it again.
 */
export const list = internalMutation({
  args: { inviteId: v.id("invites") },
  returns: v.null(),
  handler: async (ctx, { inviteId }) => {
    const invite = await ctx.db.get("invites", inviteId);
    const months = await guestListMonths(ctx);
    if (!invite || !(await due(ctx, invite, months, romanianDate(Date.now()))))
      return null;
    if (!(await deleteSome(ctx, inviteId))) {
      await ctx.scheduler.runAfter(0, internal.invites.forget.list, {
        inviteId,
      });
      return null;
    }
    if (invite.open) await ctx.db.patch("invites", inviteId, { open: false });
    return null;
  },
});
