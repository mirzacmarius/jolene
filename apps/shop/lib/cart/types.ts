import type { api } from "@jolene/backend/convex/_generated/api";
import type { FunctionReturnType } from "convex/server";

// The cart's shape is Convex's (convex/cart.ts), the one source of its prices and problems.
export type Cart = NonNullable<FunctionReturnType<typeof api.cart.get>>;

export interface CartActionResult {
  cart: Cart | null;
  /** What went wrong, for the couple to read. */
  error?: string;
}

export type CartLine = Cart["lines"][number];

/** A product as the couple chose it on its page, to put in the cart. */
export interface CartLineInput {
  answers: Array<{ key: string; value: string }>;
  /** The event a product bought for an event is for, as the digital invitation is. */
  eventId?: string;
  fees: string[];
  handle: string;
  options: Array<{ name: string; value: string }>;
  proofId?: string;
  quantity: number;
}

export type LineProblem = CartLine["problems"][number];
