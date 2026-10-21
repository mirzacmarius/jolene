import { ConvexError, v } from "convex/values";
import { mutation, type QueryCtx, query } from "../_generated/server";
import { errors } from "../utils/errors";
import { requireWorkshop } from "./staff";

/**
 * What Jolene's team sets at /studio/atelier/setari, for the accounts in
 * WORKSHOP_EMAILS alone.
 */

/**
 * How many months after its event a guest list is kept: 12 until the team
 * says otherwise, and never past 24, as the privacy policy promises.
 */
export const GUEST_LIST_MONTHS = { default: 12, min: 12, max: 24 } as const;

/** The months guest lists are kept, as the team last saved them. */
export async function guestListMonths(ctx: QueryCtx): Promise<number> {
  const settings = await ctx.db.query("settings").first();
  return settings?.guestListMonths ?? GUEST_LIST_MONTHS.default;
}

/** The settings, with the range each may take and who saved them last. */
export const get = query({
  args: {},
  returns: v.object({
    guestListMonths: v.number(),
    minGuestListMonths: v.number(),
    maxGuestListMonths: v.number(),
    updatedBy: v.union(v.string(), v.null()),
    updatedAt: v.union(v.number(), v.null()),
  }),
  handler: async (ctx) => {
    await requireWorkshop(ctx);
    const settings = await ctx.db.query("settings").first();
    return {
      guestListMonths: settings?.guestListMonths ?? GUEST_LIST_MONTHS.default,
      minGuestListMonths: GUEST_LIST_MONTHS.min,
      maxGuestListMonths: GUEST_LIST_MONTHS.max,
      updatedBy: settings?.updatedBy ?? null,
      updatedAt: settings?.updatedAt ?? null,
    };
  },
});

/** Keeps guest lists this many whole months after their event. */
export const setGuestListMonths = mutation({
  args: { months: v.number() },
  returns: v.null(),
  handler: async (ctx, { months }) => {
    const email = await requireWorkshop(ctx);
    if (
      !Number.isInteger(months) ||
      months < GUEST_LIST_MONTHS.min ||
      months > GUEST_LIST_MONTHS.max
    )
      throw new ConvexError(errors.invalidInput);
    const saved = {
      guestListMonths: months,
      updatedBy: email,
      updatedAt: Date.now(),
    };
    const settings = await ctx.db.query("settings").first();
    if (settings) await ctx.db.patch("settings", settings._id, saved);
    else await ctx.db.insert("settings", saved);
    return null;
  },
});
