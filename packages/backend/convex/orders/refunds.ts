import { type Infer, v } from "convex/values";
import type Stripe from "stripe";

/**
 * Money Stripe gives back to a couple for their order: by the workshop's
 * refund button, or from Stripe's dashboard. Convex keeps each refund as
 * Stripe last said it was (workshop/refunds.ts).
 */

/** Where a refund is, as Stripe says: pending until the card's bank has it. */
export const refundStatusValidator = v.union(
  v.literal("pending"),
  v.literal("requires_action"),
  v.literal("succeeded"),
  v.literal("failed"),
  v.literal("canceled"),
);

export type RefundStatus = Infer<typeof refundStatusValidator>;

const STATUSES: ReadonlySet<string> = new Set<RefundStatus>([
  "pending",
  "requires_action",
  "succeeded",
  "failed",
  "canceled",
]);

/** A refund as Stripe made it. */
export const stripeRefundValidator = v.object({
  /** Stripe's id for it, re_…. */
  stripeId: v.string(),
  /** In bani. */
  amount: v.number(),
  status: refundStatusValidator,
  /**
   * The workshop account that asked for it, which the refund button writes
   * in its metadata. None when someone refunded from Stripe's dashboard.
   */
  by: v.optional(v.string()),
  /** When Stripe made it. */
  createdAt: v.number(),
});

export type StripeRefund = Infer<typeof stripeRefundValidator>;

/** A refund from Stripe's API, as Convex keeps it. */
export function refundOf(refund: Stripe.Refund): StripeRefund {
  const by = refund.metadata?.by;
  return {
    stripeId: refund.id,
    amount: refund.amount,
    status:
      refund.status && STATUSES.has(refund.status)
        ? (refund.status as RefundStatus)
        : "pending",
    ...(by && { by }),
    createdAt: refund.created * 1000,
  };
}

/** Whether a refund gives the money back: it hasn't failed or been canceled. */
export function givesBack(status: RefundStatus): boolean {
  return status !== "failed" && status !== "canceled";
}
