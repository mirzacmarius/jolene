import { v } from "convex/values";
import { resolvedAssetValidator } from "../utils/assets";
import {
  documentValidator,
  fieldsValidator,
  labelsValidator,
  productKindValidator,
} from "../utils/validators";

/** A designed line's proof, as the workshop's order list shows it. */
export const proofValidator = v.object({
  id: v.id("proofs"),
  kind: productKindValidator,
  /** The collection's name; null once the catalog no longer has it. */
  suite: v.union(labelsValidator, v.null()),
  image: v.union(v.string(), v.null()),
  approvedAt: v.number(),
});

/** What a proof's print file is made from, for the workshop alone. */
export const printJobValidator = v.object({
  kind: productKindValidator,
  /** The collection's name; null once the catalog no longer has it. */
  suite: v.union(labelsValidator, v.null()),
  /** Who it's for, from the couple's details, such as "Ana & Mihai". */
  names: v.string(),
  document: documentValidator,
  fields: fieldsValidator,
  /** The files it draws: Jolene's artwork, and the couple's own photos. */
  assets: v.array(resolvedAssetValidator),
});

/**
 * Something about an order or one of its lines for the workshop to look
 * into before making it. Amounts are in lei, as Shopify writes decimals.
 */
export const issueValidator = v.union(
  /** Shopify hasn't taken the payment: the order's financial status. */
  v.object({
    kind: v.literal("not-paid"),
    status: v.union(v.string(), v.null()),
  }),
  /** Fewer than the product's minimum order. */
  v.object({ kind: v.literal("below-minimum"), minQuantity: v.number() }),
  /** A required order option the line has no answer to. */
  v.object({ kind: v.literal("missing-answer"), option: v.string() }),
  /** An answer that isn't one of its option's choices today. */
  v.object({
    kind: v.literal("unknown-choice"),
    option: v.string(),
    answer: v.string(),
  }),
  /**
   * The extras charged for the line, against what its choices cost today:
   * a crafted cart can pay less, and Jolene may have changed a price since.
   */
  v.object({
    kind: v.literal("extras"),
    paid: v.string(),
    expected: v.string(),
  }),
  /** An extras line whose product line isn't on the order. */
  v.object({ kind: v.literal("extras-alone"), paid: v.string() }),
  /** A fee chosen with a line but not charged: the fee's name. */
  v.object({ kind: v.literal("fee-missing"), fee: v.string() }),
  /** The product is gone from the store, so its options can't be checked. */
  v.object({ kind: v.literal("product-gone") }),
  /** The line names a proof the studio doesn't have. */
  v.object({ kind: v.literal("proof-missing"), proof: v.string() }),
);

export const lineValidator = v.object({
  id: v.string(),
  title: v.string(),
  /** Such as the paper; null for a product without variants. */
  variant: v.union(v.string(), v.null()),
  quantity: v.number(),
  /** What the couple chose and wrote, as the cart showed it. */
  answers: v.array(v.object({ label: v.string(), value: v.string() })),
  /** What its extras lines charged in all; null when it has none. */
  extras: v.union(v.string(), v.null()),
  proof: v.union(proofValidator, v.null()),
  issues: v.array(issueValidator),
});

export const orderValidator = v.object({
  id: v.string(),
  /** As Shopify numbers orders, such as #1001. */
  name: v.string(),
  processedAt: v.string(),
  /** The order in Shopify's admin, where it ships from. */
  url: v.string(),
  test: v.boolean(),
  note: v.union(v.string(), v.null()),
  /** Shopify's financial status, such as PAID. */
  payment: v.union(v.string(), v.null()),
  /** Shopify's fulfillment status, such as UNFULFILLED. */
  fulfillment: v.string(),
  currency: v.string(),
  /** The products ordered; their extras lines are folded into them. */
  lines: v.array(lineValidator),
  fees: v.array(v.object({ title: v.string(), quantity: v.number() })),
  issues: v.array(issueValidator),
});

export const ordersValidator = v.union(
  /** This deployment has no store to read (convex.config.ts). */
  v.object({ status: v.literal("not-connected") }),
  /** The store refused or didn't answer, in its words. */
  v.object({ status: v.literal("failed"), message: v.string() }),
  v.object({
    status: v.literal("read"),
    orders: v.array(orderValidator),
    /** More orders are open than the list reads. */
    more: v.boolean(),
    /** The store's orders in Shopify's admin. */
    admin: v.string(),
    readAt: v.number(),
  }),
);
