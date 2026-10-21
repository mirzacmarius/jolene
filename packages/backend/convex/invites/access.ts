import { getAuthUserId } from "@convex-dev/auth/server";
import { ConvexError } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { requireUser } from "../utils/auth";
import { errors } from "../utils/errors";

/**
 * Who may manage an event's digital invitation: its owner and the partners
 * who joined by the owner's link, each signed in to an account. A guest list
 * is kept with an account rather than an anonymous session, which ends with
 * the browser's storage.
 */

export type EventRole = "owner" | "partner";

/** The signed-in account; an anonymous visitor is asked to sign in. */
export async function requireAccount(ctx: QueryCtx | MutationCtx) {
  const userId = await requireUser(ctx);
  const user = await ctx.db.get("users", userId);
  if (!user || user.isAnonymous || !user.email)
    throw new ConvexError(errors.accountNeeded);
  return user;
}

/** The visitor's account, or null when they have none signed in. */
export async function viewerAccount(ctx: QueryCtx) {
  const userId = await getAuthUserId(ctx);
  const user = userId ? await ctx.db.get("users", userId) : null;
  return user && !user.isAnonymous && user.email ? user : null;
}

/** How a person manages an event: its owner, its partner, or not at all. */
export async function eventRole(
  ctx: QueryCtx,
  event: Doc<"events">,
  userId: Id<"users">,
): Promise<EventRole | null> {
  if (event.ownerId === userId) return "owner";
  const partner = await ctx.db
    .query("eventPartners")
    .withIndex("by_userId_and_eventId", (q) =>
      q.eq("userId", userId).eq("eventId", event._id),
    )
    .unique();
  return partner ? "partner" : null;
}

/** An event the signed-in account manages; anyone else's reads as not found. */
export async function requireEvent(
  ctx: QueryCtx | MutationCtx,
  eventId: Id<"events">,
) {
  const user = await requireAccount(ctx);
  const event = await ctx.db.get("events", eventId);
  const role = event && (await eventRole(ctx, event, user._id));
  if (!event || !role) throw new ConvexError(errors.notFound);
  return { user, event, role };
}

/** A digital invitation the signed-in account manages, with its event. */
export async function requireInvite(
  ctx: QueryCtx | MutationCtx,
  inviteId: Id<"invites">,
) {
  const invite = await ctx.db.get("invites", inviteId);
  if (!invite) throw new ConvexError(errors.notFound);
  return { ...(await requireEvent(ctx, invite.eventId)), invite };
}

/** A family on a guest list the signed-in account manages. */
export async function requireHousehold(
  ctx: QueryCtx | MutationCtx,
  householdId: Id<"households">,
) {
  const household = await ctx.db.get("households", householdId);
  if (!household) throw new ConvexError(errors.notFound);
  return { ...(await requireInvite(ctx, household.inviteId)), household };
}

/** The digital invitation of an event, if it has one. */
export async function inviteOf(ctx: QueryCtx, eventId: Id<"events">) {
  return await ctx.db
    .query("invites")
    .withIndex("by_eventId", (q) => q.eq("eventId", eventId))
    .unique();
}
