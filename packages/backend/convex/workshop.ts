import {
  paginationOptsValidator,
  paginationResultValidator,
} from "convex/server";
import { ConvexError, v } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc } from "./_generated/dataModel";
import { action, mutation, type QueryCtx, query } from "./_generated/server";
import { linePictures } from "./orders";
import { orderName } from "./orders/format";
import { orderUrl, shopUrl } from "./orders/links";
import { refundOf } from "./orders/refunds";
import { orderStatusValidator, statusesOf, statusOf } from "./orders/status";
import { errors } from "./utils/errors";
import { printJobOf } from "./workshop/proofs";
import { refundPayment } from "./workshop/refunds";
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

/** How many entries of an order's history its page shows, newest first. */
const HISTORY_SHOWN = 100;

/** The longest note the workshop can write on an order. */
const NOTE_LENGTH = 2000;

/** The orders, newest first, a page at a time: all, or those with a status. */
export const orders = query({
  args: {
    paginationOpts: paginationOptsValidator,
    status: v.optional(orderStatusValidator),
  },
  returns: paginationResultValidator(orderSummaryValidator),
  handler: async (ctx, { paginationOpts, status }) => {
    await requireWorkshop(ctx);
    const orders = status
      ? ctx.db
          .query("orders")
          .withIndex("by_status_and_number", (q) => q.eq("status", status))
          .order("desc")
      : ctx.db.query("orders").withIndex("by_number").order("desc");
    const page = await orders.paginate(paginationOpts);
    return {
      ...page,
      page: page.page.map((order) => ({
        number: order.number,
        name: orderName(order.number),
        paidAt: order.paidAt,
        test: order.test,
        customer: order.customer.name,
        city: order.address?.city ?? null,
        pickup: order.delivery?.key === "pickup",
        lines: order.lines.map(({ title, quantity }) => ({ title, quantity })),
        total: order.total,
        status: statusOf(order),
        refunded: order.refunded ?? 0,
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
 * chose and wrote, who paid and where it goes, where it is and what the
 * workshop noted on it. Null for a number no order has.
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
    const history = await ctx.db
      .query("orderHistory")
      .withIndex("by_orderId", (q) => q.eq("orderId", order._id))
      .order("desc")
      .take(HISTORY_SHOWN);
    const refunds = await ctx.db
      .query("refunds")
      .withIndex("by_orderId", (q) => q.eq("orderId", order._id))
      .order("desc")
      .take(HISTORY_SHOWN);
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
      status: statusOf(order),
      statuses: statusesOf(order),
      history: history.map(({ _id, _creationTime, orderId, ...entry }) => ({
        id: _id,
        at: _creationTime,
        ...entry,
      })),
      refunded: order.refunded ?? 0,
      refunds: refunds.map(({ _id, createdAt, amount, status, by }) => ({
        id: _id,
        at: createdAt,
        amount,
        status,
        ...(by && { by }),
      })),
    };
  },
});

/**
 * Moves an order on, or back, from the status the workshop's page showed.
 * If someone has moved it since, nothing changes (order-moved), and the
 * page shows where it is now. Each change goes in the order's history.
 */
export const setStatus = mutation({
  args: {
    number: v.number(),
    from: orderStatusValidator,
    status: orderStatusValidator,
  },
  returns: v.null(),
  handler: async (ctx, { number, from, status }) => {
    const by = await requireWorkshop(ctx);
    const order = await orderByNumber(ctx, number);
    if (!order) throw new ConvexError(errors.notFound);
    if (statusOf(order) !== from) throw new ConvexError(errors.orderMoved);
    if (!statusesOf(order).includes(status))
      throw new ConvexError(errors.invalidInput);
    if (status === from) return null;
    await ctx.db.patch("orders", order._id, { status });
    await ctx.db.insert("orderHistory", {
      orderId: order._id,
      by,
      kind: "status",
      from,
      status,
    });
    return null;
  },
});

/**
 * Gives money back to the couple through Stripe, at most what's left of what
 * they paid, and keeps the refund on the order. Asking twice for the same
 * refund, as a double click does, refunds once (workshop/refunds.ts).
 */
export const refund = action({
  args: { number: v.number(), amount: v.number() },
  returns: v.null(),
  handler: async (ctx, { number, amount }): Promise<null> => {
    const order = await ctx.runQuery(internal.workshop.refunds.refundable, {
      number,
    });
    if (!order) throw new ConvexError(errors.notFound);
    if (!Number.isInteger(amount) || amount <= 0 || amount > order.left)
      throw new ConvexError(errors.invalidInput);
    if (!order.paymentIntent) throw new ConvexError(errors.refundRefused);
    const refund = await refundPayment({
      orderId: order.orderId,
      name: order.name,
      paymentIntent: order.paymentIntent,
      amount,
      refunds: order.refunds,
      by: order.by,
    });
    await ctx.runMutation(internal.workshop.refunds.record, {
      paymentIntent: order.paymentIntent,
      refunds: [refundOf(refund)],
    });
    return null;
  },
});

/** Writes a note on an order, for the rest of the workshop to read. */
export const addNote = mutation({
  args: { number: v.number(), note: v.string() },
  returns: v.null(),
  handler: async (ctx, { number, note }) => {
    const by = await requireWorkshop(ctx);
    const order = await orderByNumber(ctx, number);
    if (!order) throw new ConvexError(errors.notFound);
    const text = note.trim();
    if (!text || text.length > NOTE_LENGTH)
      throw new ConvexError(errors.invalidInput);
    await ctx.db.insert("orderHistory", {
      orderId: order._id,
      by,
      kind: "note",
      note: text,
    });
    return null;
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
