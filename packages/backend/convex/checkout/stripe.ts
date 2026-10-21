import type { Language } from "@jolene/design";
import { ConvexError, type Infer, v } from "convex/values";
import Stripe from "stripe";
import { env } from "../_generated/server";
import { romanianCounty } from "../orders/counties";
import {
  type Address,
  type DeliveryKey,
  deliveryKeyValidator,
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

/**
 * Tags the shop's Checkout Sessions in Stripe's Dashboard, to tell them from
 * any other way Jolene takes payments. Stripe asks for 8 random letters at
 * the end.
 */
const INTEGRATION = "jolene-shop-xwzmartx";

/**
 * Whether Stripe Tax can work out the VAT in a payment: Jolene's Stripe
 * account has its head office and a preset product tax code, which the
 * shop's products use. Stripe Tax then puts VAT in a payment only where the
 * account has a tax registration, such as Romania's. Off when Stripe can't
 * say, so a checkout never waits on it.
 */
export async function stripeTaxReady(client: Stripe): Promise<boolean> {
  try {
    const settings = await client.tax.settings.retrieve();
    return settings.status === "active" && Boolean(settings.defaults.tax_code);
  } catch (error) {
    console.warn(
      `Stripe Tax is off for this checkout, as Stripe didn't say if it's set up: ${String(error)}`,
    );
    return false;
  }
}

/** A checkout as Convex priced it, with the picture Stripe shows by each line. */
export const checkoutForStripeValidator = v.object({
  id: v.string(),
  language: languageValidator,
  lines: v.array(orderLineValidator.extend({ image: v.optional(v.string()) })),
  fees: v.array(orderFeeValidator),
  /** The lines and the fees together, in bani: what delivery is priced on. */
  subtotal: v.number(),
});

export type CheckoutForStripe = Infer<typeof checkoutForStripeValidator>;

/**
 * What Stripe's page says under a line's name: its paper, whose design it
 * is, and whose event it's for.
 */
function describe(line: OrderLine, language: Language): string | undefined {
  const parts = line.options.map(({ name, value }) => `${name}: ${value}`);
  if (line.proof)
    parts.push(language === "ro" ? "Cu designul vostru" : "With your design");
  if (line.event)
    parts.push(
      language === "ro"
        ? `Pentru ${line.event.hosts}`
        : `For ${line.event.hosts}`,
    );
  return parts.length > 0 ? parts.join(" · ") : undefined;
}

/**
 * The Checkout Session for a checkout: its lines and fees in lei, the ways it
 * can reach an address in Romania with the couple's phone for them, unless
 * nothing in the order travels, the billing address and, for a company, its
 * name and tax code, which its invoice needs, and the shop's pages Stripe
 * sends them back to. Prices include VAT, so Stripe Tax, when `vat` turns it
 * on, shows the VAT inside them and never adds to what the couple pays.
 */
export function sessionParams(
  checkout: CheckoutForStripe,
  shop: string,
  { vat }: { vat: boolean },
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
      tax_behavior: "inclusive" as const,
      product_data: {
        name,
        ...(description && { description }),
        ...(image && { images: [image] }),
      },
    },
  });
  // A line bought for an event, as the digital invitation is, goes by link.
  const travels = checkout.lines.some((line) => !line.event);
  return {
    mode: "payment",
    integration_identifier: INTEGRATION,
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
    ...(travels && {
      shipping_address_collection: {
        allowed_countries: [...deliveryCountries],
      },
      shipping_options: deliveryOptions(
        checkout.subtotal,
        checkout.language,
      ).map((option) => ({
        shipping_rate_data: {
          type: "fixed_amount" as const,
          display_name: option.label,
          fixed_amount: { amount: option.price, currency: "ron" },
          tax_behavior: "inclusive" as const,
          // Names the way it travels, whatever the language of its label.
          metadata: { delivery: option.key },
        },
      })),
    }),
    // The delivery address unless the couple gives another.
    billing_address_collection: "required",
    // "Buying as a business": the company's name and CUI, for its invoice.
    tax_id_collection: { enabled: true },
    automatic_tax: { enabled: vat },
    phone_number_collection: { enabled: travels },
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

/** An address as Stripe's page took it, with its county in Romania. */
function addressOf(name: string, address: Stripe.Address): Address {
  const country = address.country ?? "";
  const county =
    country === "RO"
      ? romanianCounty(address.state, address.postal_code)
      : address.state?.trim();
  return {
    name,
    line1: address.line1 ?? "",
    ...(address.line2 && { line2: address.line2 }),
    city: address.city ?? "",
    ...(county && { county }),
    ...(address.postal_code && { postalCode: address.postal_code }),
    country,
  };
}

/** Which way an order travels, as the shipping rate Convex offered names it. */
function deliveryKey(
  rate: Stripe.ShippingRate | string | null | undefined,
): DeliveryKey | undefined {
  if (typeof rate !== "object" || !rate) return undefined;
  const key = rate.metadata?.delivery;
  return deliveryKeyValidator.members.find((member) => member.value === key)
    ?.value;
}

/**
 * What a paid Checkout Session says of its order: who paid, where it goes,
 * who the invoice is for, what Stripe charged and, when Stripe Tax worked it
 * out, the VAT in it. Null until it's paid, and for a session no checkout
 * opened.
 */
export function paidSession(
  session: Stripe.Checkout.Session,
): PaidSession | null {
  const paid =
    session.status === "complete" &&
    (session.payment_status === "paid" ||
      session.payment_status === "no_payment_required");
  // Convex names its checkout in both the reference and the metadata. The
  // buyer of a Payment Link can set the reference in its address, never the
  // metadata, so a session that lacks either isn't a checkout's.
  const checkout = session.client_reference_id;
  if (!paid || !checkout || session.metadata?.checkout !== checkout)
    return null;
  const details = session.customer_details;
  const shipping = session.collected_information?.shipping_details;
  const address = shipping?.address;
  const taxId = details?.tax_ids?.find((id) => id.value)?.value;
  const rate = session.shipping_cost?.shipping_rate;
  const key = deliveryKey(rate);
  const paymentIntent =
    typeof session.payment_intent === "string"
      ? session.payment_intent
      : session.payment_intent?.id;
  return {
    id: session.id,
    checkout,
    ...(paymentIntent && { paymentIntent }),
    test: !session.livemode,
    customer: {
      name: details?.name ?? shipping?.name ?? "",
      email: details?.email ?? "",
      ...(details?.phone && { phone: details.phone }),
    },
    ...(shipping &&
      address && {
        address: addressOf(shipping.name ?? details?.name ?? "", address),
      }),
    ...(details?.address && {
      billing: {
        ...(details.business_name && { company: details.business_name }),
        ...(taxId && { taxId }),
        address: addressOf(
          details.individual_name || details.name || "",
          details.address,
        ),
      },
    }),
    ...(session.shipping_cost && {
      delivery: {
        ...(key && { key }),
        label: (typeof rate === "object" && rate?.display_name) || "",
        price: session.shipping_cost.amount_total,
      },
    }),
    subtotal: session.amount_subtotal ?? 0,
    discount: session.total_details?.amount_discount ?? 0,
    total: session.amount_total ?? 0,
    ...(session.automatic_tax?.enabled &&
      session.automatic_tax.status === "complete" && {
        vat: session.total_details?.amount_tax ?? 0,
      }),
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
