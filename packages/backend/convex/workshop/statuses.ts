import { v } from "convex/values";
import { internal } from "../_generated/api";
import { internalMutation } from "../_generated/server";
import { statusOf } from "../orders/status";

/** How many orders one run gives a status. */
const ORDERS_PER_RUN = 100;

/**
 * Gives the orders paid before statuses their first, so the workshop's
 * lists find them by it, a batch at a time. The seed runs it on every
 * deployment; once every order has one, it reads nothing.
 */
export const backfill = internalMutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const orders = await ctx.db
      .query("orders")
      .withIndex("by_status_and_number", (q) => q.eq("status", undefined))
      .take(ORDERS_PER_RUN);
    for (const order of orders)
      await ctx.db.patch("orders", order._id, { status: statusOf(order) });
    if (orders.length === ORDERS_PER_RUN)
      await ctx.scheduler.runAfter(0, internal.workshop.statuses.backfill, {});
    return null;
  },
});
