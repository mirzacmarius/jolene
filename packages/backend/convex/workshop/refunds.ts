import { ConvexError, v } from "convex/values";
import Stripe from "stripe";
import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import {
  type ActionCtx,
  internalMutation,
  internalQuery,
} from "../_generated/server";
import { stripe } from "../checkout/stripe";
import { orderName } from "../orders/format";
import { givesBack, refundOf, stripeRefundValidator } from "../orders/refunds";
import { errors } from "../utils/errors";
import { requireWorkshop } from "./staff";

/**
 * Refunds: the workshop gives money back from an order's page
 * (workshop.refund), and Stripe's webhook brings the refunds made from its
 * dashboard and each refund's later news (checkout.ts). Either way Convex
 * reads the refund from Stripe and keeps it as Stripe said it was.
 */

/** The most refunds of one order Convex reads: far more than any has. */
const REFUNDS_READ = 100;

/** What refunding an order needs, for an account of the workshop. */
export const refundable = internalQuery({
  args: { number: v.number() },
  returns: v.union(
    v.object({
      orderId: v.id("orders"),
      name: v.string(),
      /** Its payment in Stripe; none when nothing was charged. */
      paymentIntent: v.union(v.string(), v.null()),
      /** What's left to give back, in bani. */
      left: v.number(),
      /** How many refunds it has had, failed ones too. */
      refunds: v.number(),
      /** The workshop account asking. */
      by: v.string(),
    }),
    v.null(),
  ),
  handler: async (ctx, { number }) => {
    const by = await requireWorkshop(ctx);
    const order = await ctx.db
      .query("orders")
      .withIndex("by_number", (q) => q.eq("number", number))
      .unique();
    if (!order) return null;
    const refunds = await ctx.db
      .query("refunds")
      .withIndex("by_orderId", (q) => q.eq("orderId", order._id))
      .take(REFUNDS_READ);
    return {
      orderId: order._id,
      name: orderName(order.number),
      paymentIntent: order.paymentIntent ?? null,
      left: order.total - (order.refunded ?? 0),
      refunds: refunds.length,
      by,
    };
  },
});

/** Whether a Stripe payment is one of this deployment's orders. */
export const paidHere = internalQuery({
  args: { paymentIntent: v.string() },
  returns: v.boolean(),
  handler: async (ctx, { paymentIntent }) =>
    (await ctx.db
      .query("orders")
      .withIndex("by_paymentIntent", (q) =>
        q.eq("paymentIntent", paymentIntent),
      )
      .first()) !== null,
});

/**
 * Keeps an order's refunds as Stripe said they were, each once by its id,
 * and what they gave back on the order. Nothing happens for a payment that
 * isn't one of this deployment's orders, such as a preview's.
 */
export const record = internalMutation({
  args: {
    paymentIntent: v.string(),
    refunds: v.array(stripeRefundValidator),
  },
  returns: v.null(),
  handler: async (ctx, { paymentIntent, refunds }) => {
    const order = await ctx.db
      .query("orders")
      .withIndex("by_paymentIntent", (q) =>
        q.eq("paymentIntent", paymentIntent),
      )
      .first();
    if (!order) return null;
    for (const { by, ...refund } of refunds) {
      const known = await ctx.db
        .query("refunds")
        .withIndex("by_stripeId", (q) => q.eq("stripeId", refund.stripeId))
        .unique();
      if (!known)
        await ctx.db.insert("refunds", {
          orderId: order._id,
          ...refund,
          ...(by && { by }),
        });
      else if (
        known.status !== refund.status ||
        known.amount !== refund.amount ||
        (by && !known.by)
      )
        await ctx.db.patch("refunds", known._id, {
          status: refund.status,
          amount: refund.amount,
          ...(by && !known.by && { by }),
        });
    }
    const all = await ctx.db
      .query("refunds")
      .withIndex("by_orderId", (q) => q.eq("orderId", order._id))
      .take(REFUNDS_READ);
    const refunded = all
      .filter((refund) => givesBack(refund.status))
      .reduce((sum, refund) => sum + refund.amount, 0);
    if (refunded !== (order.refunded ?? 0))
      await ctx.db.patch("orders", order._id, { refunded });
    return null;
  },
});

/**
 * Asks Stripe to give back part or all of an order's payment, as the
 * workshop account `by`. The key makes asking twice for the same refund,
 * as a double click does, refund once: Stripe answers a repeat with the
 * first refund, and a different account's repeat with an error.
 */
export async function refundPayment({
  orderId,
  name,
  paymentIntent,
  amount,
  refunds,
  by,
}: {
  orderId: Id<"orders">;
  name: string;
  paymentIntent: string;
  amount: number;
  /** How many refunds the order has had, so a later one has a key of its own. */
  refunds: number;
  by: string;
}) {
  try {
    return await stripe().refunds.create(
      {
        payment_intent: paymentIntent,
        amount,
        reason: "requested_by_customer",
        metadata: { order: name, by },
      },
      { idempotencyKey: `refund-${orderId}-${refunds}-${amount}` },
    );
  } catch (error) {
    if (error instanceof Stripe.errors.StripePermissionError)
      throw new ConvexError(errors.refundNotAllowed);
    if (error instanceof Stripe.errors.StripeIdempotencyError)
      throw new ConvexError(errors.sameRefund);
    if (error instanceof Stripe.errors.StripeInvalidRequestError) {
      console.warn(`Stripe refused to refund ${name}: ${error.message}`);
      throw new ConvexError(errors.refundRefused);
    }
    throw error;
  }
}

/**
 * Reads a payment's refunds again from Stripe and keeps them, for Stripe's
 * webhook: the event's copy may be older than another that came first. A
 * payment that isn't one of this deployment's orders is left alone, as a
 * preview shares production's Stripe account in test mode.
 */
export async function syncRefunds(ctx: ActionCtx, paymentIntent: string) {
  if (
    !(await ctx.runQuery(internal.workshop.refunds.paidHere, { paymentIntent }))
  )
    return;
  let refunds: Stripe.Refund[];
  try {
    const list = await stripe().refunds.list({
      payment_intent: paymentIntent,
      limit: REFUNDS_READ,
    });
    refunds = list.data;
  } catch (error) {
    // Stripe would send the event again for days: say so once instead.
    if (error instanceof Stripe.errors.StripePermissionError) {
      console.warn(
        `Stripe's key may not read refunds, so a refund of ${paymentIntent} isn't on its order: give the key Refunds' permission.`,
      );
      return;
    }
    throw error;
  }
  await ctx.runMutation(internal.workshop.refunds.record, {
    paymentIntent,
    refunds: refunds.map(refundOf),
  });
}
