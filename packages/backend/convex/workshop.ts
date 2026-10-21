import {
  paginationOptsValidator,
  paginationResultValidator,
} from "convex/server";
import { v } from "convex/values";
import type { Doc } from "./_generated/dataModel";
import { type QueryCtx, query } from "./_generated/server";
import { linePictures } from "./orders";
import { orderName } from "./orders/format";
import { orderUrl, shopUrl } from "./orders/links";
import { printJobOf } from "./workshop/proofs";
import { requireWorkshop, workshopAccess } from "./workshop/staff";
import {
  accessValidator,
  orderSummaryValidator,
  printJobValidator,
  workshopOrderValidator,
} from "./workshop/validators";

/**
 * Jolene's workshop: the orders couples paid for, for the accounts in
 * WORKSHOP_EMAILS, at /studio/atelier (docs/adr/0009).
 */

/** Who is signed in, as the workshop's pages need to know. */
export const access = query({
  args: {},
  returns: accessValidator,
  handler: async (ctx) => await workshopAccess(ctx),
});

/** The orders, newest first, a page at a time. */
export const orders = query({
  args: { paginationOpts: paginationOptsValidator },
  returns: paginationResultValidator(orderSummaryValidator),
  handler: async (ctx, { paginationOpts }) => {
    await requireWorkshop(ctx);
    const page = await ctx.db
      .query("orders")
      .withIndex("by_number")
      .order("desc")
      .paginate(paginationOpts);
    return {
      ...page,
      page: page.page.map((order) => ({
        number: order.number,
        name: orderName(order.number),
        paidAt: order.paidAt,
        test: order.test,
        customer: order.customer.name,
        city: order.address?.city ?? null,
        lines: order.lines.map(({ title, quantity }) => ({ title, quantity })),
        total: order.total,
      })),
    };
  },
});

async function orderByNumber(ctx: QueryCtx, number: number) {
  return await ctx.db
    .query("orders")
    .withIndex("by_number", (q) => q.eq("number", number))
    .unique();
}

/** The payment in Stripe's dashboard, in test mode for a test order. */
function paymentUrl(order: Doc<"orders">) {
  return order.paymentIntent
    ? `https://dashboard.stripe.com/${order.test ? "test/" : ""}payments/${order.paymentIntent}`
    : null;
}

/**
 * One order, all of it: each line with its proof or photo, what the couple
 * chose and wrote, who paid and where it goes. Null for a number no order
 * has.
 */
export const order = query({
  args: { number: v.number() },
  returns: v.union(workshopOrderValidator, v.null()),
  handler: async (ctx, { number }) => {
    await requireWorkshop(ctx);
    const order = await orderByNumber(ctx, number);
    if (!order) return null;
    const pictures = await linePictures(ctx, order);
    const shop = shopUrl();
    return {
      number: order.number,
      name: orderName(order.number),
      paidAt: order.paidAt,
      test: order.test,
      language: order.language,
      lines: order.lines.map(({ proof, ...line }, index) => {
        const picture = pictures[index];
        const summary = picture?.proof;
        return {
          ...line,
          image: picture?.image ?? null,
          ...(proof && {
            proof: summary
              ? {
                  id: summary.id,
                  kind: summary.kind,
                  suite: summary.suite,
                  image: summary.image,
                  approvedAt: summary.approvedAt,
                }
              : null,
          }),
        };
      }),
      fees: order.fees,
      subtotal: order.subtotal,
      ...(order.delivery && { delivery: order.delivery }),
      discount: order.discount,
      total: order.total,
      ...(order.vat !== undefined && { vat: order.vat }),
      customer: order.customer,
      ...(order.address && { address: order.address }),
      page: shop && orderUrl(shop, order.token),
      payment: paymentUrl(order),
    };
  },
});

/**
 * What the print file of an order's designed line is made from, for the
 * studio, which makes the file (apps/studio/src/app/studio/api/print-files).
 * Null for a line with no proof, or a proof the studio no longer has.
 */
export const printJob = query({
  args: { number: v.number(), line: v.number() },
  returns: v.union(printJobValidator, v.null()),
  handler: async (ctx, { number, line }) => {
    await requireWorkshop(ctx);
    const order = await orderByNumber(ctx, number);
    const ordered = order?.lines[line];
    const job = ordered?.proof && (await printJobOf(ctx, ordered.proof));
    return order && ordered && job
      ? { order: orderName(order.number), quantity: ordered.quantity, ...job }
      : null;
  },
});
