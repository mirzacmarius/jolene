import { type Infer, v } from "convex/values";
import { pickedValidator } from "../shop/validators";

/** A line of an order, as the cart priced it when the couple went to pay. */
export const orderLineValidator = v.object({
  /** The product's handle, as in /products/<handle>. */
  product: v.string(),
  title: v.string(),
  quantity: v.number(),
  /** A value for each of the product's options, such as its paper. */
  options: v.array(pickedValidator),
  /** The order options' answers, with the label each was asked by. */
  answers: v.array(
    v.object({ key: v.string(), label: v.string(), value: v.string() }),
  ),
  /** The design the couple approved for it in the studio. */
  proof: v.optional(v.id("proofs")),
  /**
   * The event it was bought for, as the digital invitation is, with whose
   * it is in the order's language.
   */
  event: v.optional(v.object({ id: v.id("events"), hosts: v.string() })),
  /** One of it, in bani, with its paper's surcharge and paid choices. */
  price: v.number(),
  /** `price` times `quantity`. */
  total: v.number(),
});

/** A fee the order pays once, as it was priced. */
export const orderFeeValidator = v.object({
  key: v.string(),
  label: v.string(),
  price: v.number(),
});

/** Where a courier brings an order, as the couple wrote it at checkout. */
export const addressValidator = v.object({
  /** Who receives it. */
  name: v.string(),
  line1: v.string(),
  line2: v.optional(v.string()),
  city: v.string(),
  /** The county (județ). */
  county: v.optional(v.string()),
  postalCode: v.optional(v.string()),
  /** Two letters, such as RO. */
  country: v.string(),
});

/**
 * Who an order's invoice is made out to, as the couple gave it on Stripe's
 * page: the payer at their billing address, or the company they bought as.
 */
export const billingValidator = v.object({
  /** The company's name, when they bought as a company. */
  company: v.optional(v.string()),
  /** The company's tax code as Stripe's page took it: a CUI or VAT number. */
  taxId: v.optional(v.string()),
  /** The payer's name and billing address. */
  address: addressValidator,
});

/**
 * An invoice in SmartBill (convex/invoices.ts): being issued, issued, or
 * refused. A credit note, which reverses an invoice, is kept the same way.
 */
export const invoiceValidator = v.object({
  status: v.union(
    v.literal("issuing"),
    v.literal("issued"),
    v.literal("failed"),
  ),
  /** When it was asked for, then when it was issued or refused. */
  at: v.number(),
  /** Its series and number in SmartBill, as JOL and 0042. */
  series: v.optional(v.string()),
  number: v.optional(v.string()),
  /** A test order's: a draft in SmartBill, never a fiscal document. */
  draft: v.optional(v.boolean()),
  /** Its PDF, as SmartBill made it. */
  file: v.optional(v.id("_storage")),
  /** Why SmartBill refused it. */
  error: v.optional(v.string()),
  /** What went wrong once it was issued, for the team to look at. */
  warning: v.optional(v.string()),
});

export const customerValidator = v.object({
  name: v.string(),
  email: v.string(),
  phone: v.optional(v.string()),
});

/**
 * Which way an order travels (checkout/delivery.ts): a courier to the door, or
 * picked up from the workshop in Iași.
 */
export const deliveryKeyValidator = v.union(
  v.literal("courier"),
  v.literal("pickup"),
);

/** How an order travels, as Stripe's page named it, and what that cost in bani. */
export const deliveryValidator = v.object({
  /** None on an order whose delivery Convex didn't offer by key. */
  key: v.optional(deliveryKeyValidator),
  label: v.string(),
  price: v.number(),
});

/** What a paid Checkout Session says of its order, as Stripe charged it. */
export const paidSessionValidator = v.object({
  /** The Checkout Session's id. */
  id: v.string(),
  /** The checkout it was made for, as the shop told Stripe. */
  checkout: v.string(),
  paymentIntent: v.optional(v.string()),
  /** Paid in Stripe's test mode. */
  test: v.boolean(),
  customer: customerValidator,
  address: v.optional(addressValidator),
  billing: v.optional(billingValidator),
  delivery: v.optional(deliveryValidator),
  /** The lines and fees as Stripe added them up, in bani. */
  subtotal: v.number(),
  discount: v.number(),
  total: v.number(),
  /** The VAT in the total, as Stripe Tax worked it out; none when it was off. */
  vat: v.optional(v.number()),
});

export type Address = Infer<typeof addressValidator>;
export type Invoice = Infer<typeof invoiceValidator>;
export type DeliveryKey = Infer<typeof deliveryKeyValidator>;
export type OrderLine = Infer<typeof orderLineValidator>;
export type OrderFee = Infer<typeof orderFeeValidator>;
export type PaidSession = Infer<typeof paidSessionValidator>;
