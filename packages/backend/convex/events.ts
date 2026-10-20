import { getAuthUserId } from "@convex-dev/auth/server";
import { fieldProblem, type Occasion, occasions } from "@jolene/design";
import { ConvexError, v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import {
  type MutationCtx,
  mutation,
  type QueryCtx,
  query,
} from "./_generated/server";
import { requireUser } from "./utils/auth";
import { errors } from "./utils/errors";
import { fieldsValidator, occasionValidator } from "./utils/validators";

/** One of the signed-in visitor's events; anyone else's reads as not found. */
async function requireOwnEvent(ctx: MutationCtx, eventId: Id<"events">) {
  const ownerId = await requireUser(ctx);
  const event = await ctx.db.get("events", eventId);
  if (!event || event.ownerId !== ownerId)
    throw new ConvexError(errors.notFound);
  return event;
}

/**
 * The visitor's latest event of an occasion: the wedding (or christening) a
 * design they start next joins, whichever collection it comes from.
 */
export async function latestEvent(
  ctx: QueryCtx,
  ownerId: Id<"users">,
  occasion: Occasion,
) {
  return await ctx.db
    .query("events")
    .withIndex("by_ownerId_and_occasion", (q) =>
      q.eq("ownerId", ownerId).eq("occasion", occasion),
    )
    .order("desc")
    .first();
}

/**
 * The details of the signed-in visitor's latest event of each occasion,
 * once they've given some: every collection previews with them, as the
 * designs started from it will show them.
 */
export const latestFields = query({
  args: {},
  returns: v.array(
    v.object({ occasion: occasionValidator, fields: fieldsValidator }),
  ),
  handler: async (ctx) => {
    const ownerId = await getAuthUserId(ctx);
    if (!ownerId) return [];
    const found = [];
    for (const occasion of occasions) {
      const event = await latestEvent(ctx, ownerId, occasion);
      if (event && Object.keys(event.fields).length > 0)
        found.push({ occasion, fields: event.fields });
    }
    return found;
  },
});

/**
 * Saves some of the couple's details; the rest stay as they are. An empty
 * value clears its field. Every design of the event shows the change at once.
 */
export const setFields = mutation({
  args: { eventId: v.id("events"), fields: fieldsValidator },
  returns: v.null(),
  handler: async (ctx, args) => {
    const event = await requireOwnEvent(ctx, args.eventId);
    const fields = { ...event.fields };
    for (const [key, value] of Object.entries(args.fields)) {
      if (fieldProblem(event.occasion, key, value))
        throw new ConvexError(errors.invalidField);
      if (value === "") delete fields[key];
      else fields[key] = value;
    }
    await ctx.db.patch("events", event._id, { fields, updatedAt: Date.now() });
    return null;
  },
});
