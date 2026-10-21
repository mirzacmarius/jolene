import { ConvexError, v } from "convex/values";
import type { Doc } from "./_generated/dataModel";
import { mutation, type QueryCtx, query } from "./_generated/server";
import {
  eventRole,
  requireAccount,
  requireEvent,
  viewerAccount,
} from "./invites/access";
import { hostNames } from "./invites/text";
import { errors } from "./utils/errors";
import { languageValidator, occasionValidator } from "./utils/validators";

/**
 * A couple manages their digital invitation together: one of them starts
 * it, and sends the other a link (invites.setPartnerLink) to join the event
 * from their own account.
 */

async function inviteByPartnerCode(ctx: QueryCtx, code: string) {
  const invite = await ctx.db
    .query("invites")
    .withIndex("by_partnerCode", (q) => q.eq("partnerCode", code))
    .unique();
  const event = invite && (await ctx.db.get("events", invite.eventId));
  return invite && event ? { invite, event } : null;
}

/** What a partner's link leads to, before they join. */
export const preview = query({
  args: { code: v.string(), language: languageValidator },
  returns: v.union(
    v.null(),
    v.object({
      eventId: v.id("events"),
      occasion: occasionValidator,
      hosts: v.string(),
      /** Who the visitor is to the event: not yet anyone, unless signed in. */
      viewer: v.union(
        v.literal("account-needed"),
        v.literal("owner"),
        v.literal("partner"),
        v.literal("can-join"),
      ),
    }),
  ),
  handler: async (ctx, args) => {
    const found = await inviteByPartnerCode(ctx, args.code);
    if (!found) return null;
    const { event } = found;
    const user = await viewerAccount(ctx);
    const role = user ? await eventRole(ctx, event, user._id) : null;
    return {
      eventId: event._id,
      occasion: event.occasion,
      hosts: hostNames(event.occasion, event.fields, args.language),
      viewer: !user
        ? ("account-needed" as const)
        : (role ?? ("can-join" as const)),
    };
  },
});

/** Joins the signed-in account to the event a partner's link is for. */
export const join = mutation({
  args: { code: v.string() },
  returns: v.id("events"),
  handler: async (ctx, args) => {
    const user = await requireAccount(ctx);
    const found = await inviteByPartnerCode(ctx, args.code);
    if (!found) throw new ConvexError(errors.notFound);
    const { event } = found;
    if (!(await eventRole(ctx, event, user._id)))
      await ctx.db.insert("eventPartners", {
        eventId: event._id,
        userId: user._id,
        joinedAt: Date.now(),
      });
    return event._id;
  },
});

/**
 * Takes a partner off the event: the owner ends a partner's access, or a
 * partner leaves.
 */
export const remove = mutation({
  args: { eventId: v.id("events"), userId: v.id("users") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { user, role } = await requireEvent(ctx, args.eventId);
    if (role !== "owner" && args.userId !== user._id)
      throw new ConvexError(errors.notFound);
    const partner: Doc<"eventPartners"> | null = await ctx.db
      .query("eventPartners")
      .withIndex("by_userId_and_eventId", (q) =>
        q.eq("userId", args.userId).eq("eventId", args.eventId),
      )
      .unique();
    if (partner) await ctx.db.delete("eventPartners", partner._id);
    return null;
  },
});
