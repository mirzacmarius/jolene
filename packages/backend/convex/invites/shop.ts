import { v } from "convex/values";
import type { Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import { labelsValidator, occasionValidator } from "../utils/validators";
import { inviteOf } from "./access";
import { hosts } from "./text";

/**
 * What the shop shows of an event whose digital invitation a couple buys
 * (ADR 0014): whose it is and when, the card guests see, and whether it's
 * open to all of them already.
 */
export const eventForShopValidator = v.object({
  id: v.id("events"),
  occasion: occasionValidator,
  hosts: labelsValidator,
  /** As the couple gave it, 2027-06-12. */
  date: v.union(v.string(), v.null()),
  /** The picture of the invitation guests see, once it's published. */
  image: v.union(v.string(), v.null()),
  unlocked: v.boolean(),
});

export async function eventForShop(ctx: QueryCtx, eventId: Id<"events">) {
  const event = await ctx.db.get("events", eventId);
  if (!event) return null;
  const invite = await inviteOf(ctx, event._id);
  const image = invite?.published?.image;
  return {
    id: event._id,
    occasion: event.occasion,
    hosts: hosts(event),
    date: event.fields.date?.trim() || null,
    image: image ? await ctx.storage.getUrl(image) : null,
    unlocked: Boolean(invite?.unlocked),
  };
}
