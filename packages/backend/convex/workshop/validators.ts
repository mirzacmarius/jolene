import { v } from "convex/values";
import { orderStatusValidator } from "../orders/status";
import {
  addressValidator,
  customerValidator,
  deliveryValidator,
  orderFeeValidator,
  orderLineValidator,
} from "../orders/validators";
import { photoValidator } from "../shop/photos";
import { resolvedAssetValidator } from "../utils/assets";
import {
  documentValidator,
  fieldsValidator,
  labelsValidator,
  languageValidator,
  productKindValidator,
} from "../utils/validators";

/** Who the workshop's pages see signed in. */
export const accessValidator = v.union(
  /** No one with an account: a couple designing without one, or no one. */
  v.object({ signedIn: v.literal(false) }),
  v.object({
    signedIn: v.literal(true),
    email: v.string(),
    /** One of the accounts in WORKSHOP_EMAILS. */
    allowed: v.boolean(),
  }),
);

/** An order as the workshop's list shows it. */
export const orderSummaryValidator = v.object({
  number: v.number(),
  /** What the couple and the workshop call it, as J1001. */
  name: v.string(),
  paidAt: v.number(),
  test: v.boolean(),
  /** Who paid. */
  customer: v.string(),
  /** The town it goes to; null when nothing in it travels. */
  city: v.union(v.string(), v.null()),
  /** The couple picks it up from the workshop: Cargus brings it to no one. */
  pickup: v.boolean(),
  lines: v.array(v.object({ title: v.string(), quantity: v.number() })),
  /** What Stripe charged, in bani. */
  total: v.number(),
  status: orderStatusValidator,
});

/** A designed line's proof, as the workshop's order page shows it. */
export const proofValidator = v.object({
  id: v.id("proofs"),
  kind: productKindValidator,
  suite: labelsValidator,
  image: v.union(v.string(), v.null()),
  approvedAt: v.number(),
});

/** An entry in an order's history, as the workshop's order page shows it. */
export const historyEntryValidator = v.union(
  v.object({
    id: v.id("orderHistory"),
    at: v.number(),
    /** The workshop account's email. */
    by: v.string(),
    kind: v.literal("status"),
    from: orderStatusValidator,
    status: orderStatusValidator,
  }),
  v.object({
    id: v.id("orderHistory"),
    at: v.number(),
    by: v.string(),
    kind: v.literal("note"),
    note: v.string(),
  }),
);

/** An order as the workshop's order page shows it: all of it. */
export const workshopOrderValidator = v.object({
  number: v.number(),
  name: v.string(),
  paidAt: v.number(),
  test: v.boolean(),
  /** The language the couple paid in, which their emails speak. */
  language: languageValidator,
  lines: v.array(
    orderLineValidator.omit("proof").extend({
      /** The product's photo, or the invitation guests see for an event's. */
      image: v.union(photoValidator, v.null()),
      /** Null when the studio no longer has the line's proof. */
      proof: v.optional(v.union(proofValidator, v.null())),
    }),
  ),
  fees: v.array(orderFeeValidator),
  subtotal: v.number(),
  delivery: v.optional(deliveryValidator),
  discount: v.number(),
  total: v.number(),
  vat: v.optional(v.number()),
  customer: customerValidator,
  address: v.optional(addressValidator),
  /** The couple's order page in the shop; null until the shop's address is set. */
  page: v.union(v.string(), v.null()),
  /** The payment in Stripe's dashboard; null when Stripe gave none. */
  payment: v.union(v.string(), v.null()),
  status: orderStatusValidator,
  /** The statuses it can have, in the order it goes through them. */
  statuses: v.array(orderStatusValidator),
  /** Its changes of status and the workshop's notes, newest first. */
  history: v.array(historyEntryValidator),
});

/** What the print file of an order's designed line is made from. */
export const printJobValidator = v.object({
  /** The order's name, such as J1001, which the file's pages carry. */
  order: v.string(),
  /** How many of it the order has. */
  quantity: v.number(),
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
