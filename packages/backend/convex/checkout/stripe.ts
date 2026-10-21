import type { Language } from "@jolene/design";
import { ConvexError, type Infer, v } from "convex/values";
import Stripe from "stripe";
import { env } from "../_generated/server";
import {
  type OrderLine,
  orderFeeValidator,
  orderLineValidator,
  type PaidSession,
} from "../orders/validators";
import { errors } from "../utils/errors";
import { languageValidator } from "../utils/validators";
import { deliveryCountries, deliveryOptions } from "./delivery";

/**
 * Stripe takes the couple's payment on its own Checkout page (ADR 0015). The
 * shop's server opens a Checkout Session for the cart as Convex priced it,
 * and the order is recorded from the session once Stripe says it's paid.
 */

/** Stripe's API, read when called so a key set on the deployment applies at once. */
export function stripe(): Stripe {
  const key = env.STRIPE_SECRET_KEY?.trim();
  if (!key) throw new ConvexError(errors.checkoutUnavailable);
  const standIn = env.STRIPE_API_URL?.trim();
  const url = standIn ? new URL(standIn) : undefined;
  return new Stripe(key, {
    httpClient: Stripe.createFetchHttpClient(),
    maxNetworkRetries: 2,
    ...(url && {
      host: url.hostname,
      port: url.port,
      protocol: url.protocol === "http:" ? "http" : "https",
    }),
  });
}

/** A checkout as Convex priced it, with the picture Stripe shows by each line. */
export const checkoutForStripeValidator = v.object({
  id: v.string(),
  language: languageValidator,
  lines: v.array(orderLineValidator.extend({ image: v.optional(v.string()) })),
  fees: v.array(orderFeeValidator),
});

export type CheckoutForStripe = Infer<typeof checkoutForStripeValidator>;

/** What Stripe's page says under a line's name: its paper, and whose design it is. */
function describe(line: OrderLine, language: Language): string | undefined {
  const parts = line.options.map(({ name, value }) => `${name}: ${value}`);
  if (line.proof)
    parts.push(language === "ro" ? "Cu designul vostru" : "With your design");
  return parts.length > 0 ? parts.join(" · ") : undefined;
}

/**
 * The Checkout Session for a checkout: its lines and fees in lei, a courier
 * to an address in Romania, the couple's phone for the courier, and the
 * shop's pages Stripe sends them back to.
 */
export function sessionParams(
  checkout: CheckoutForStripe,
  shop: string,
): Stripe.Checkout.SessionCreateParams {
  const item = (
    name: string,
    price: number,
    quantity: number,
    description?: string,
    image?: string,
  ) => ({
    quantity,
    price_data: {
      currency: "ron",
      unit_amount: price,
      product_data: {
        name,
        ...(description && { description }),
        ...(image && { images: [image] }),
      },
    },
  });
  return {
    mode: "payment",
    client_reference_id: checkout.id,
    metadata: { checkout: checkout.id },
    locale: checkout.language,
    line_items: [
      ...checkout.lines.map((line) =>
        item(
          line.title,
          line.price,
          line.quantity,
          describe(line, checkout.language),
          line.image,
        ),
      ),
      ...checkout.fees.map((fee) => item(fee.label, fee.price, 1)),
    ],
    shipping_address_collection: { allowed_countries: [...deliveryCountries] },
    shipping_options: deliveryOptions.map((option) => ({
      shipping_rate_data: {
        type: "fixed_amount",
        display_name: option.label,
        fixed_amount: { amount: option.price, currency: "ron" },
      },
    })),
    phone_number_collection: { enabled: true },
    allow_promotion_codes: true,
    success_url: `${shop}/checkout/return?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${shop}/cart`,
  };
}

/** A Checkout Session as Stripe has it now, with its delivery's name. */
export async function retrieveSession(id: string) {
  return await stripe().checkout.sessions.retrieve(id, {
    expand: ["shipping_cost.shipping_rate"],
  });
}

/**
 * What a paid Checkout Session says of its order: who paid, where it goes and
 * what Stripe charged. Null until it's paid, and for a session no checkout
 * opened.
 */
export function paidSession(
  session: Stripe.Checkout.Session,
): PaidSession | null {
  const paid =
    session.status === "complete" &&
    (session.payment_status === "paid" ||
      session.payment_status === "no_payment_required");
  if (!paid || !session.client_reference_id) return null;
  const details = session.customer_details;
  const shipping = session.collected_information?.shipping_details;
  const address = shipping?.address;
  const rate = session.shipping_cost?.shipping_rate;
  const paymentIntent =
    typeof session.payment_intent === "string"
      ? session.payment_intent
      : session.payment_intent?.id;
  return {
    id: session.id,
    checkout: session.client_reference_id,
    ...(paymentIntent && { paymentIntent }),
    test: !session.livemode,
    customer: {
      name: details?.name ?? shipping?.name ?? "",
      email: details?.email ?? "",
      ...(details?.phone && { phone: details.phone }),
    },
    ...(shipping &&
      address && {
        address: {
          name: shipping.name ?? details?.name ?? "",
          line1: address.line1 ?? "",
          ...(address.line2 && { line2: address.line2 }),
          city: address.city ?? "",
          ...(address.state && { county: address.state }),
          ...(address.postal_code && { postalCode: address.postal_code }),
          country: address.country ?? "",
        },
      }),
    ...(session.shipping_cost && {
      delivery: {
        label: (typeof rate === "object" && rate?.display_name) || "",
        price: session.shipping_cost.amount_total,
      },
    }),
    subtotal: session.amount_subtotal ?? 0,
    discount: session.total_details?.amount_discount ?? 0,
    total: session.amount_total ?? 0,
  };
}

/** Stripe's webhook event, if its signature is the webhook secret's. */
export async function verifiedEvent(
  payload: string,
  signature: string | null,
): Promise<Stripe.Event | null> {
  const secret = env.STRIPE_WEBHOOK_SECRET?.trim();
  if (!secret || !signature) return null;
  try {
    return await Stripe.webhooks.constructEventAsync(
      payload,
      signature,
      secret,
      undefined,
      Stripe.createSubtleCryptoProvider(),
    );
  } catch {
    return null;
  }
}
