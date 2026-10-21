import { assetKeys, type DesignDocument } from "@jolene/design";
import { ConvexError, v } from "convex/values";
import type { Doc } from "./_generated/dataModel";
import {
  type MutationCtx,
  mutation,
  type QueryCtx,
  query,
} from "./_generated/server";
import { saveReply } from "./households";
import { householdCode } from "./invites/codes";
import {
  canOpen,
  cleanReply,
  LENGTHS,
  MAX_HOUSEHOLDS,
  MAX_SEATS,
  repliesClosed,
} from "./invites/rules";
import { hostNames } from "./invites/text";
import {
  questionsValidator,
  replyInputValidator,
  replyValidator,
} from "./invites/validators";
import { resolveAssets, resolvedAssetValidator } from "./utils/assets";
import { errors } from "./utils/errors";
import { rateLimiter } from "./utils/limits";
import {
  documentValidator,
  fieldsValidator,
  languageValidator,
  occasionValidator,
} from "./utils/validators";

/**
 * A digital invitation as its guests open it, without signing in: by their
 * family's own link (the invitation's address and their code), or by the
 * invitation's address alone, its open link, where a family adds itself as
 * it replies. What they read is the design the couple published, with the
 * event's details as they are now.
 */

async function inviteBySlug(ctx: QueryCtx, slug: string) {
  return await ctx.db
    .query("invites")
    .withIndex("by_slug", (q) => q.eq("slug", slug.toLowerCase()))
    .unique();
}

async function householdByCode(
  ctx: QueryCtx,
  invite: Doc<"invites">,
  code: string,
) {
  return await ctx.db
    .query("households")
    .withIndex("by_inviteId_and_code", (q) =>
      q.eq("inviteId", invite._id).eq("code", code.toLowerCase()),
    )
    .unique();
}

/**
 * The invitation and family a link opens, when guests may use it: the
 * couple published a design, and it's paid for, or the family is one of
 * the trial. The open link needs the invitation paid for and open.
 */
async function openable(ctx: QueryCtx, slug: string, code: string | undefined) {
  const invite = await inviteBySlug(ctx, slug);
  const household =
    invite && code ? await householdByCode(ctx, invite, code) : null;
  if (!invite || (code && !household)) return { kind: "not-found" as const };
  const event = await ctx.db.get("events", invite.eventId);
  if (!event) return { kind: "not-found" as const };
  if (!invite.published) return { kind: "unpublished" as const };
  if (household) {
    if (!(await canOpen(ctx, invite, household)))
      return { kind: "locked" as const };
  } else {
    if (!invite.unlocked) return { kind: "locked" as const };
    if (!invite.open) return { kind: "personal" as const };
  }
  return { kind: "ready" as const, invite, household, event };
}

/**
 * What a guest's page shows, in the language the guest asked for, else the
 * family's, else the invitation's. The couple's private notes stay out.
 */
export const open = query({
  args: {
    slug: v.string(),
    code: v.optional(v.string()),
    language: v.optional(languageValidator),
  },
  returns: v.union(
    v.object({
      kind: v.union(
        v.literal("not-found"),
        v.literal("unpublished"),
        v.literal("locked"),
        v.literal("personal"),
      ),
    }),
    v.object({
      kind: v.literal("ready"),
      slug: v.string(),
      /** The page's language: the guest's choice, the family's, or the invitation's. */
      language: languageValidator,
      occasion: occasionValidator,
      /** The event's details, the family's name as {{guestName}}. */
      fields: fieldsValidator,
      document: documentValidator,
      assets: v.array(resolvedAssetValidator),
      /** The studio's picture of the design, for link previews. */
      image: v.union(v.string(), v.null()),
      /** Who the invitation is from, as guests read it. */
      hosts: v.string(),
      questions: questionsValidator,
      note: v.union(v.string(), v.null()),
      household: v.union(
        v.object({
          name: v.string(),
          code: v.string(),
          seats: v.number(),
          plusOne: v.boolean(),
          reply: v.union(replyValidator, v.null()),
        }),
        v.null(),
      ),
    }),
  ),
  handler: async (ctx, args) => {
    const found = await openable(ctx, args.slug, args.code);
    if (found.kind !== "ready") return { kind: found.kind };
    const { invite, household, event } = found;
    const published = invite.published as NonNullable<typeof invite.published>;
    const document = published.document as DesignDocument;
    const language = args.language ?? household?.language ?? invite.language;
    const fields = household
      ? { ...event.fields, guestName: household.name }
      : event.fields;
    return {
      kind: "ready" as const,
      slug: invite.slug,
      language,
      occasion: event.occasion,
      fields: Object.fromEntries(
        Object.entries(fields).filter(
          (entry): entry is [string, string] => typeof entry[1] === "string",
        ),
      ),
      document,
      // A couple's photo resolves for them, the event's owner.
      assets: await resolveAssets(ctx, assetKeys(document), event.ownerId),
      image: published.image ? await ctx.storage.getUrl(published.image) : null,
      hosts: hostNames(event.occasion, event.fields, language),
      questions: invite.questions,
      note: invite.note ?? null,
      household: household
        ? {
            name: household.name,
            code: household.code,
            seats: household.seats,
            plusOne: household.plusOne,
            reply: household.reply ?? null,
          }
        : null,
    };
  },
});

/** The family and invitation a link may reply through, or an error. */
async function replyable(ctx: MutationCtx, slug: string, code?: string) {
  const found = await openable(ctx, slug, code);
  if (found.kind === "not-found" || found.kind === "unpublished")
    throw new ConvexError(errors.notFound);
  if (found.kind !== "ready") throw new ConvexError(errors.inviteLocked);
  if (repliesClosed(found.event.fields, Date.now()))
    throw new ConvexError(errors.replyClosed);
  return found;
}

/** Notes the first time a family opens their invitation, for the couple. */
export const seen = mutation({
  args: { slug: v.string(), code: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const invite = await inviteBySlug(ctx, args.slug);
    const household = invite && (await householdByCode(ctx, invite, args.code));
    if (household && !household.openedAt)
      await ctx.db.patch("households", household._id, {
        openedAt: Date.now(),
      });
    return null;
  },
});

/**
 * A family's reply through their link, until the reply date. A later one
 * replaces it; the couple's history keeps both.
 */
export const reply = mutation({
  args: { slug: v.string(), code: v.string(), reply: replyInputValidator },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { invite, household } = await replyable(ctx, args.slug, args.code);
    if (!household) throw new ConvexError(errors.notFound);
    const limit = await rateLimiter.limit(ctx, "reply", { key: household._id });
    if (!limit.ok) throw new ConvexError(errors.tooMany);
    const reply = cleanReply(
      args.reply,
      household,
      invite.questions,
      "guest",
      Date.now(),
    );
    await saveReply(ctx, household, reply);
    return null;
  },
});

/**
 * A family replying through the open link, which adds them to the guest
 * list as they wrote their name. Gives their code: their own link changes
 * the reply later.
 */
export const join = mutation({
  args: {
    slug: v.string(),
    name: v.string(),
    reply: replyInputValidator,
    language: v.optional(languageValidator),
  },
  returns: v.string(),
  handler: async (ctx, args) => {
    const { invite } = await replyable(ctx, args.slug);
    const limit = await rateLimiter.limit(ctx, "join", { key: invite._id });
    if (!limit.ok) throw new ConvexError(errors.tooMany);
    const name = args.name.trim();
    if (!name || name.length > LENGTHS.name)
      throw new ConvexError(errors.invalidInput);
    const kept = await ctx.db
      .query("households")
      .withIndex("by_inviteId", (q) => q.eq("inviteId", invite._id))
      .take(MAX_HOUSEHOLDS);
    if (kept.length >= MAX_HOUSEHOLDS)
      throw new ConvexError(errors.tooManyHouseholds);
    // They're invited as the people they say come.
    const seats = Math.min(
      MAX_SEATS,
      Math.max(1, args.reply.guests.filter((guest) => !guest.plusOne).length),
    );
    const household = { seats, plusOne: false };
    const now = Date.now();
    const reply = cleanReply(
      args.reply,
      household,
      invite.questions,
      "guest",
      now,
    );
    let code = householdCode();
    while (await householdByCode(ctx, invite, code)) code = householdCode();
    const householdId = await ctx.db.insert("households", {
      inviteId: invite._id,
      name,
      code,
      ...household,
      language: args.language,
      source: "open",
      openedAt: now,
      updatedAt: now,
    });
    const created = await ctx.db.get("households", householdId);
    if (created) await saveReply(ctx, created, reply);
    return code;
  },
});
