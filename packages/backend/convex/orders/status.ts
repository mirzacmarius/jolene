import { type Infer, v } from "convex/values";
import type { Doc } from "../_generated/dataModel";

/**
 * Where an order is between paid and in the couple's hands. The workshop
 * moves it on (workshop.ts): being made, then sent by courier or ready to
 * pick up, then done; or cancelled.
 */
export const orderStatusValidator = v.union(
  v.literal("paid"),
  v.literal("making"),
  v.literal("sent"),
  v.literal("ready"),
  v.literal("done"),
  v.literal("cancelled"),
);

export type OrderStatus = Infer<typeof orderStatusValidator>;

/**
 * An order's status when it's paid: an order with nothing to deliver, such
 * as a digital invitation alone, has nothing to make either.
 */
export function firstStatus(delivered: boolean): OrderStatus {
  return delivered ? "paid" : "done";
}

/** An order's status; orders paid before statuses get their first. */
export function statusOf(order: Doc<"orders">): OrderStatus {
  return order.status ?? firstStatus(order.delivery !== undefined);
}

/**
 * The statuses an order can have, in the order it goes through them: one
 * the couple picks up is ready rather than sent, and one with nothing to
 * deliver is only done or cancelled.
 */
export function statusesOf(order: Doc<"orders">): OrderStatus[] {
  if (!order.delivery) return ["done", "cancelled"];
  const delivered = order.delivery.key === "pickup" ? "ready" : "sent";
  return ["paid", "making", delivered, "done", "cancelled"];
}
