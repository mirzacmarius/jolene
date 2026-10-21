import {
  afterEach,
  beforeEach,
  describe,
  expect,
  setSystemTime,
  spyOn,
  test,
} from "bun:test";
import { digitalInvitation } from "@jolene/products/digital-invitation";
import Stripe from "stripe";
import { testConvex } from "../test/convex";
import { fakeStripe } from "../test/stripe";
import { api, internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { paidSession } from "./checkout/stripe";
import { confirmationEmail, noticeEmail } from "./orders/emails";
import { lei } from "./orders/format";
import { errors } from "./utils/errors";

const token = "c".repeat(40);
const webhookSecret = "whsec_test_secret";

/** Classic Roses' invitation, 30 of them with paid choices and a fee. */
const roses = {
  token,
  handle: "invitatie-de-nunta-classic-roses",
  quantity: 30,
  options: [{ name: "Carton", value: "Ivory texturat 300 gr" }],
  answers: [
    { key: "culoare-sigiliu", value: "Alb" },
    { key: "panglica", value: "Panglică mătase" },
    { key: "text-personalizat", value: "Ana și Mihai" },
  ],
  fees: ["diacritice-50"],
};

/** What the cart above costs: 30 at 10,50 lei, and 50 lei for diacritics. */
const subtotal = 36_500;

const checkoutEnv = [
  "SITE_URL",
  "SHOP_URL",
  "SHOP_SECRET",
  "STRIPE_SECRET_KEY",
  "STRIPE_WEBHOOK_SECRET",
] as const;

let stripe: ReturnType<typeof fakeStripe> | undefined;

beforeEach(() => {
  Object.assign(process.env, {
    SITE_URL: "http://localhost:3024/studio",
    STRIPE_SECRET_KEY: "sk_test_jolene",
    STRIPE_WEBHOOK_SECRET: webhookSecret,
  });
});

afterEach(() => {
  stripe?.restore();
  stripe = undefined;
  setSystemTime();
  for (const name of checkoutEnv) Reflect.deleteProperty(process.env, name);
});

/** The shop's catalog with roses in the cart, and Stripe standing by. */
async function withCart() {
  const t = testConvex();
  await t.action(internal.init.seed, {});
  await t.mutation(api.cart.add, roses);
  stripe = fakeStripe();
  return { t, stripe };
}

/** The checkout the shop opened, and its Stripe session paid. */
async function paid(setup: Awaited<ReturnType<typeof withCart>>) {
  await setup.t.action(api.checkout.start, {
    token,
    language: "ro",
    unlockNow: true,
  });
  return setup.stripe.pay(setup.stripe.latest().id);
}

async function orders(t: ReturnType<typeof testConvex>) {
  return await t.run((ctx) => ctx.db.query("orders").take(10));
}

const expectError = async (promise: Promise<unknown>, code: string) =>
  expect(promise).rejects.toMatchObject({ data: code });

describe("checkout.start", () => {
  test("opens Stripe's page for the cart as Convex prices it", async () => {
    const { t, stripe } = await withCart();
    const url = await t.action(api.checkout.start, { token, language: "ro" });
    const session = stripe.latest();
    expect(url).toBe(session.url as string);

    const [request] = stripe.opened();
    const fields = Object.fromEntries(request?.fields ?? []);
    const checkouts = await t.run((ctx) => ctx.db.query("checkouts").take(5));
    expect(checkouts).toHaveLength(1);
    const checkout = checkouts[0] as Doc<"checkouts">;
    expect(request?.headers.get("idempotency-key")).toBe(
      `checkout-${checkout._id}`,
    );
    expect(fields).toMatchObject({
      mode: "payment",
      integration_identifier: "jolene-shop-xwzmartx",
      client_reference_id: checkout._id,
      locale: "ro",
      "line_items[0][quantity]": "30",
      "line_items[0][price_data][currency]": "ron",
      "line_items[0][price_data][unit_amount]": "1050",
      "line_items[0][price_data][tax_behavior]": "inclusive",
      "line_items[0][price_data][product_data][description]":
        "Carton: Ivory texturat 300 gr",
      "line_items[1][quantity]": "1",
      "line_items[1][price_data][unit_amount]": "5000",
      "line_items[1][price_data][product_data][name]": "Diacritice",
      "line_items[1][price_data][tax_behavior]": "inclusive",
      "shipping_address_collection[allowed_countries][0]": "RO",
      "shipping_options[0][shipping_rate_data][display_name]":
        "Curier la adresă",
      "shipping_options[0][shipping_rate_data][fixed_amount][amount]": "2500",
      "shipping_options[0][shipping_rate_data][tax_behavior]": "inclusive",
      "shipping_options[0][shipping_rate_data][metadata][delivery]": "courier",
      "shipping_options[1][shipping_rate_data][display_name]":
        "Ridicare de la atelier, Str. Ion Creangă 41, Iași",
      "shipping_options[1][shipping_rate_data][fixed_amount][amount]": "0",
      "shipping_options[1][shipping_rate_data][tax_behavior]": "inclusive",
      "shipping_options[1][shipping_rate_data][metadata][delivery]": "pickup",
      billing_address_collection: "required",
      "tax_id_collection[enabled]": "true",
      "automatic_tax[enabled]": "false",
      "phone_number_collection[enabled]": "true",
      allow_promotion_codes: "true",
      success_url:
        "http://localhost:3024/checkout/return?session_id={CHECKOUT_SESSION_ID}",
      cancel_url: "http://localhost:3024/cart",
    });
    expect(checkout).toMatchObject({
      subtotal,
      language: "ro",
      fees: [{ key: "diacritice-50", label: "Diacritice", price: 5000 }],
      lines: [
        {
          product: roses.handle,
          quantity: 30,
          price: 1050,
          total: 31_500,
          answers: [
            { key: "culoare-sigiliu", label: "Culoare sigiliu", value: "Alb" },
            { key: "panglica", label: "Panglică", value: "Panglică mătase" },
            {
              key: "text-personalizat",
              label: "Text personalizat",
              value: "Ana și Mihai",
            },
          ],
        },
      ],
    });
    expect(session.amount_subtotal).toBe(subtotal);
    expect(stripe.rates(session.id)).toHaveLength(2);
  });

  test("brings an order of 800 lei or more by courier for nothing", async () => {
    const { t, stripe } = await withCart();
    const lineId = (await t.query(api.cart.get, { token }))?.lines[0]?.id;
    if (!lineId) throw new Error("No line in the cart");
    // 71 roses and diacritics come to 795,50 lei, 72 to 806 lei.
    for (const quantity of [71, 72]) {
      await t.mutation(api.cart.setQuantity, { token, lineId, quantity });
      await t.action(api.checkout.start, { token, language: "en" });
    }
    expect(
      stripe
        .opened()
        .map((request) =>
          [0, 1].map(
            (i) =>
              `${request.fields.get(`shipping_options[${i}][shipping_rate_data][display_name]`)}: ${request.fields.get(`shipping_options[${i}][shipping_rate_data][fixed_amount][amount]`)}`,
          ),
        ),
    ).toEqual([
      [
        "Courier to your door: 2500",
        "Pick up from the workshop, Str. Ion Creangă 41, Iași: 0",
      ],
      [
        "Courier to your door: 0",
        "Pick up from the workshop, Str. Ion Creangă 41, Iași: 0",
      ],
    ]);
  });

  test("sends the couple back to SHOP_URL's address when it's set", async () => {
    process.env.SHOP_URL = "https://www.orvibo.it/";
    const { t, stripe } = await withCart();
    await t.action(api.checkout.start, { token, language: "ro" });
    const fields = Object.fromEntries(stripe.opened()[0]?.fields ?? []);
    expect(fields).toMatchObject({
      success_url:
        "https://www.orvibo.it/checkout/return?session_id={CHECKOUT_SESSION_ID}",
      cancel_url: "https://www.orvibo.it/cart",
    });
  });

  test("speaks the couple's language on Stripe's page", async () => {
    const { t, stripe } = await withCart();
    await t.action(api.checkout.start, { token, language: "en" });
    expect(stripe.opened()[0]?.fields.get("locale")).toBe("en");
  });

  test("lets Stripe Tax find the VAT in the prices once it's set up", async () => {
    const { t, stripe } = await withCart();
    stripe.tax("set up");
    await t.action(api.checkout.start, { token, language: "ro" });
    expect(stripe.opened()[0]?.fields.get("automatic_tax[enabled]")).toBe(
      "true",
    );
  });

  test("leaves Stripe Tax off until it's set up, and when Stripe won't say", async () => {
    const { t, stripe } = await withCart();
    stripe.tax("no tax code");
    await t.action(api.checkout.start, { token, language: "ro" });
    stripe.tax("forbidden");
    const warn = spyOn(console, "warn").mockImplementation(() => {});
    try {
      const url = await t.action(api.checkout.start, {
        token,
        language: "ro",
      });
      expect(url).toBe(stripe.latest().url as string);
      expect(String(warn.mock.calls[0]?.[0])).toStartWith(
        "Stripe Tax is off for this checkout, as Stripe didn't say if it's set up",
      );
    } finally {
      warn.mockRestore();
    }
    expect(
      stripe
        .opened()
        .map((request) => request.fields.get("automatic_tax[enabled]")),
    ).toEqual(["false", "false"]);
  });

  test("refuses a cart with nothing to pay for, or a line short of its minimum", async () => {
    const { t } = await withCart();
    await expectError(
      t.action(api.checkout.start, { token: "d".repeat(40), language: "ro" }),
      errors.cartEmpty,
    );
    const lines = await t.query(api.cart.get, { token });
    const lineId = lines?.lines[0]?.id;
    if (!lineId) throw new Error("No line in the cart");
    await t.mutation(api.cart.setQuantity, { token, lineId, quantity: 10 });
    await expectError(
      t.action(api.checkout.start, { token, language: "ro" }),
      errors.cartNotReady,
    );
    await t.mutation(api.cart.remove, { token, lineId });
    await expectError(
      t.action(api.checkout.start, { token, language: "ro" }),
      errors.cartEmpty,
    );
    expect(await t.run((ctx) => ctx.db.query("checkouts").take(5))).toEqual([]);
  });

  test("opens only for the shop's server once it shares SHOP_SECRET", async () => {
    const { t, stripe } = await withCart();
    process.env.SHOP_SECRET = "shop-secret";
    const visitor = "203.0.113.7";
    for (const server of [undefined, { secret: "a-guess", visitor }])
      await expectError(
        t.action(api.checkout.start, {
          token,
          language: "ro",
          ...(server && { server }),
        }),
        errors.shopOnly,
      );
    expect(stripe.requests).toEqual([]);
    const url = await t.action(api.checkout.start, {
      token,
      language: "ro",
      server: { secret: "shop-secret", visitor },
    });
    expect(url).toBe(stripe.latest().url as string);
  });

  test("gives each visitor the shop's server names a limit of their own", async () => {
    const { t } = await withCart();
    process.env.SHOP_SECRET = "shop-secret";
    const open = (cart: string, visitor: string) =>
      t.action(api.checkout.start, {
        token: cart,
        language: "ro",
        server: { secret: "shop-secret", visitor },
      });
    // A script filling throwaway carts from one home's addresses.
    const carts = Array.from({ length: 11 }, (_, i) =>
      String(i).padStart(40, "e"),
    );
    for (const cart of carts)
      await t.mutation(api.cart.add, { ...roses, token: cart });
    for (const [i, cart] of carts.slice(0, 10).entries())
      await open(cart, i % 2 ? "2001:db8:1:2::7" : "2001:db8:1:2:aa::1");
    await expectError(
      open(carts[10] as string, "2001:db8:1:2::8"),
      errors.tooMany,
    );
    // Couples elsewhere still pay.
    await open(token, "198.51.100.4");
  });

  test("names no visitor until the shop shares SHOP_SECRET", async () => {
    const { t } = await withCart();
    const carts = Array.from({ length: 11 }, (_, i) =>
      String(i).padStart(40, "e"),
    );
    for (const cart of carts) {
      await t.mutation(api.cart.add, { ...roses, token: cart });
      await t.action(api.checkout.start, {
        token: cart,
        language: "ro",
        server: { secret: "anything", visitor: "203.0.113.7" },
      });
    }
  });

  test("stays closed on a deployment without Stripe", async () => {
    const { t, stripe } = await withCart();
    Reflect.deleteProperty(process.env, "STRIPE_SECRET_KEY");
    await expectError(
      t.action(api.checkout.start, { token, language: "ro" }),
      errors.checkoutUnavailable,
    );
    expect(stripe.requests).toEqual([]);
  });
});

describe("checkout.confirm", () => {
  test("records the paid order once, and takes its lines out of the cart", async () => {
    const setup = await withCart();
    const { t } = setup;
    const session = await paid(setup);
    const orderToken = await t.action(api.checkout.confirm, {
      session: session.id,
    });
    expect(orderToken).toHaveLength(32);
    expect(
      await t.query(api.orders.byToken, { token: orderToken as string }),
    ).toMatchObject({
      name: "J1001",
      test: true,
      language: "ro",
      lines: [
        {
          product: roses.handle,
          title: expect.stringContaining("Classic Roses"),
          quantity: 30,
          price: 1050,
          total: 31_500,
        },
      ],
      fees: [{ key: "diacritice-50", label: "Diacritice", price: 5000 }],
      subtotal,
      delivery: {
        key: "courier",
        label: "Curier la adresă",
        price: 2500,
      },
      discount: 0,
      total: subtotal + 2500,
      customer: { name: "ANA POPESCU", email: "ana@example.com" },
      address: {
        name: "Ana Popescu",
        line1: "Strada Florilor 1",
        line2: "Ap. 2",
        city: "Cluj-Napoca",
        county: "Cluj",
        postalCode: "400000",
        country: "RO",
      },
      // The workshop makes it next.
      status: "paid",
    });
    expect(
      await t.query(api.orders.byToken, { token: orderToken as string }),
    ).not.toHaveProperty("pickupAt");
    const cart = await t.query(api.cart.get, { token });
    expect(cart?.lines).toEqual([]);
    expect(await t.run((ctx) => ctx.db.query("checkouts").take(5))).toEqual([]);

    // The couple refreshes the page they came back to.
    expect(await t.action(api.checkout.confirm, { session: session.id })).toBe(
      orderToken,
    );
    const [order] = await orders(t);
    expect(await orders(t)).toHaveLength(1);
    expect(order).toMatchObject({
      session: session.id,
      paymentIntent: session.payment_intent as string,
      customer: { phone: "+40712345678" },
      // Who the invoice is for: the payer, at the delivery address.
      billing: {
        address: {
          name: "ANA POPESCU",
          line1: "Strada Florilor 1",
          city: "Cluj-Napoca",
          county: "Cluj",
          postalCode: "400000",
          country: "RO",
        },
      },
    });
    expect(order?.billing).not.toHaveProperty("company");
    expect(order).not.toHaveProperty("vat");
    // The shop sent the tick, but nothing in the cart asked for it.
    expect(order).not.toHaveProperty("unlockNowAt");
  });

  test("keeps the company a couple bought as, for its invoice", async () => {
    const { t, stripe } = await withCart();
    await t.action(api.checkout.start, { token, language: "ro" });
    const session = stripe.pay(stripe.latest().id, {
      company: { name: "Nunta Ana SRL", taxId: "RO44776462" },
    });
    await t.action(api.checkout.confirm, { session: session.id });
    const [order] = await orders(t);
    expect(order?.billing).toMatchObject({
      company: "Nunta Ana SRL",
      taxId: "RO44776462",
      address: { name: "ANA POPESCU", city: "Cluj-Napoca" },
    });
    if (!order) throw new Error("No order recorded");
    expect(noticeEmail(order, null).text).toContain(
      "Factură pe firmă: Nunta Ana SRL · CUI RO44776462\nAdresa de facturare: aceeași cu cea de mai sus\n",
    );
  });

  test("keeps the VAT Stripe Tax found in the total", async () => {
    const setup = await withCart();
    const { t } = setup;
    setup.stripe.tax("set up");
    const session = await paid(setup);
    const orderToken = await t.action(api.checkout.confirm, {
      session: session.id,
    });
    // 21% inside 390 lei.
    expect(
      await t.query(api.orders.byToken, { token: orderToken as string }),
    ).toMatchObject({ total: 39_000, vat: 6769 });
  });

  test("keeps the couple's choice to pick it up from the workshop", async () => {
    const { t, stripe } = await withCart();
    await t.action(api.checkout.start, { token, language: "ro" });
    const session = stripe.pay(stripe.latest().id, { delivery: 1 });
    const orderToken = await t.action(api.checkout.confirm, {
      session: session.id,
    });
    expect(
      await t.query(api.orders.byToken, { token: orderToken as string }),
    ).toMatchObject({
      subtotal,
      delivery: {
        key: "pickup",
        label: "Ridicare de la atelier, Str. Ion Creangă 41, Iași",
        price: 0,
      },
      total: subtotal,
      // Stripe's page asks for an address all the same.
      address: { city: "Cluj-Napoca" },
      pickupAt: "Str. Ion Creangă 41, Iași",
    });
  });

  test("numbers orders one after another", async () => {
    const setup = await withCart();
    const { t } = setup;
    const first = await paid(setup);
    await t.action(api.checkout.confirm, { session: first.id });
    await t.mutation(api.cart.add, roses);
    const second = await paid(setup);
    const secondToken = await t.action(api.checkout.confirm, {
      session: second.id,
    });
    expect(
      (await t.query(api.orders.byToken, { token: secondToken as string }))
        ?.name,
    ).toBe("J1002");
  });

  test("keeps a promotion code's discount", async () => {
    const { t, stripe } = await withCart();
    await t.action(api.checkout.start, { token, language: "ro" });
    const session = stripe.pay(stripe.latest().id, { discount: 3650 });
    const orderToken = await t.action(api.checkout.confirm, {
      session: session.id,
    });
    expect(
      await t.query(api.orders.byToken, { token: orderToken as string }),
    ).toMatchObject({
      subtotal,
      discount: 3650,
      total: subtotal - 3650 + 2500,
    });
  });

  test("records nothing while the session is unpaid, or for another shop's", async () => {
    const { t, stripe } = await withCart();
    await t.action(api.checkout.start, { token, language: "ro" });
    const session = stripe.latest();
    expect(
      await t.action(api.checkout.confirm, { session: session.id }),
    ).toBeNull();

    // A session another deployment opened, in the same Stripe account.
    stripe.pay(session.id);
    session.client_reference_id = "k57aaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
    expect(
      await t.action(api.checkout.confirm, { session: session.id }),
    ).toBeNull();
    expect(
      await t.action(api.checkout.confirm, { session: "cs_test_missing" }),
    ).toBeNull();

    const asked = stripe.requests.length;
    expect(
      await t.action(api.checkout.confirm, { session: "../../v1/charges" }),
    ).toBeNull();
    expect(stripe.requests).toHaveLength(asked);
    expect(await orders(t)).toEqual([]);
  });

  test("records nothing for a session whose buyer named the checkout, as on a Payment Link", async () => {
    const { t, stripe } = await withCart();
    await t.action(api.checkout.start, { token, language: "ro" });
    const opened = stripe.latest();
    expect(opened.metadata).toEqual({ checkout: opened.client_reference_id });

    // A Payment Link of the same Stripe account, 1 leu and nothing to send,
    // opened with the checkout's id in its address: Stripe keeps that as
    // the session's reference.
    const link = {
      ...opened,
      id: "cs_test_paymentlink",
      metadata: {},
      amount_subtotal: 100,
      shipping_address_collection: null,
    };
    stripe.sessions.set(link.id, link);
    stripe.pay(link.id);
    expect(
      await t.action(api.checkout.confirm, { session: link.id }),
    ).toBeNull();
    expect(await orders(t)).toEqual([]);

    stripe.pay(opened.id);
    expect(
      await t.action(api.checkout.confirm, { session: opened.id }),
    ).toEqual(expect.any(String));
    expect(await orders(t)).toHaveLength(1);
  });
});

describe("Stripe's webhook", () => {
  /** A webhook event of a session, signed with `secret`. */
  async function event(
    type: string,
    session: Record<string, unknown>,
    secret = webhookSecret,
  ) {
    const payload = JSON.stringify({
      id: `evt_${crypto.randomUUID()}`,
      object: "event",
      type,
      api_version: "2026-09-30.endive",
      created: Math.floor(Date.now() / 1000),
      livemode: false,
      pending_webhooks: 1,
      request: { id: null, idempotency_key: null },
      data: { object: session },
    });
    const signature = await Stripe.webhooks.generateTestHeaderStringAsync({
      payload,
      secret,
      cryptoProvider: Stripe.createSubtleCryptoProvider(),
    });
    return {
      method: "POST",
      headers: { "stripe-signature": signature },
      body: payload,
    };
  }

  test("records a completed session's order, with its delivery's name", async () => {
    const setup = await withCart();
    const { t } = setup;
    const session = await paid(setup);
    const response = await t.fetch(
      "/stripe-webhook",
      await event("checkout.session.completed", session),
    );
    expect(response.status).toBe(200);
    expect(await orders(t)).toMatchObject([
      {
        number: 1001,
        session: session.id,
        delivery: {
          key: "courier",
          label: "Curier la adresă",
          price: 2500,
        },
      },
    ]);

    // Stripe sends it again: nothing more is recorded, nor asked of Stripe.
    const asked = setup.stripe.requests.length;
    const again = await t.fetch(
      "/stripe-webhook",
      await event("checkout.session.completed", session),
    );
    expect(again.status).toBe(200);
    expect(setup.stripe.requests).toHaveLength(asked);
    expect(await orders(t)).toHaveLength(1);
  });

  test("records an order paid after its session completed", async () => {
    const { t, stripe } = await withCart();
    await t.action(api.checkout.start, { token, language: "ro" });
    const session = stripe.latest();
    // Completed, but the bank hasn't paid yet.
    Object.assign(session, { status: "complete" });
    await t.fetch(
      "/stripe-webhook",
      await event("checkout.session.completed", session),
    );
    expect(await orders(t)).toEqual([]);
    stripe.pay(session.id);
    await t.fetch(
      "/stripe-webhook",
      await event("checkout.session.async_payment_succeeded", session),
    );
    expect(await orders(t)).toHaveLength(1);
  });

  test("refuses an event Stripe didn't sign", async () => {
    const setup = await withCart();
    const { t } = setup;
    const session = await paid(setup);
    const forged = await t.fetch(
      "/stripe-webhook",
      await event("checkout.session.completed", session, "whsec_other"),
    );
    expect(forged.status).toBe(400);
    const unsigned = await t.fetch("/stripe-webhook", {
      method: "POST",
      body: JSON.stringify({ type: "checkout.session.completed" }),
    });
    expect(unsigned.status).toBe(400);
    expect(await orders(t)).toEqual([]);
  });
});

describe("checkout.reconcile", () => {
  test("records the paid sessions nothing else did, once", async () => {
    const setup = await withCart();
    const { t } = setup;
    const session = await paid(setup);
    expect(await t.action(internal.checkout.reconcile, {})).toBe(1);
    expect(await orders(t)).toMatchObject([
      {
        session: session.id,
        delivery: {
          key: "courier",
          label: "Curier la adresă",
          price: 2500,
        },
      },
    ]);
    expect(await t.action(internal.checkout.reconcile, {})).toBe(0);
    expect(await orders(t)).toHaveLength(1);
  });
});

describe("checkout.forget", () => {
  test("forgets checkouts no one paid for after a month", async () => {
    const { t } = await withCart();
    setSystemTime(new Date("2027-01-01T10:00:00Z"));
    await t.action(api.checkout.start, { token, language: "ro" });
    setSystemTime(new Date("2027-01-25T10:00:00Z"));
    await t.action(api.checkout.start, { token, language: "ro" });
    setSystemTime(new Date("2027-02-05T10:00:00Z"));
    await t.mutation(internal.checkout.forget, {});
    expect(
      await t.run((ctx) => ctx.db.query("checkouts").take(5)),
    ).toHaveLength(1);
  });
});

describe("the digital invitation", () => {
  /** A couple's wedding, its digital invitation alone in the cart. */
  async function withInvitation() {
    const t = testConvex();
    await t.action(internal.init.seed, {});
    const eventId = await t.run(async (ctx) =>
      ctx.db.insert("events", {
        ownerId: await ctx.db.insert("users", { isAnonymous: true }),
        occasion: "wedding",
        fields: { partner1: "Ana", partner2: "Mihai", date: "2027-06-12" },
        updatedAt: Date.now(),
      }),
    );
    await t.mutation(api.cart.add, {
      token,
      handle: digitalInvitation.handle,
      quantity: 1,
      options: [],
      answers: [],
      fees: [],
      eventId,
    });
    stripe = fakeStripe();
    return { t, stripe, eventId };
  }

  const inviteOf = (t: ReturnType<typeof testConvex>, eventId: Id<"events">) =>
    t.run((ctx) =>
      ctx.db
        .query("invites")
        .withIndex("by_eventId", (q) => q.eq("eventId", eventId))
        .unique(),
    );

  test("asks for no address when nothing travels, and unlocks the event once paid", async () => {
    const { t, stripe, eventId } = await withInvitation();
    await t.action(api.checkout.start, {
      token,
      language: "ro",
      unlockNow: true,
    });
    const fields = Object.fromEntries(stripe.opened()[0]?.fields ?? []);
    expect(fields).toMatchObject({
      "line_items[0][quantity]": "1",
      "line_items[0][price_data][unit_amount]": "24900",
      "line_items[0][price_data][product_data][name]": "Invitație digitală",
      "line_items[0][price_data][product_data][description]":
        "Pentru Ana și Mihai",
      "phone_number_collection[enabled]": "false",
    });
    expect(
      Object.keys(fields).filter((key) => key.startsWith("shipping")),
    ).toEqual([]);

    const session = stripe.pay(stripe.latest().id);
    const orderToken = await t.action(api.checkout.confirm, {
      session: session.id,
    });
    const order = await t.query(api.orders.byToken, {
      token: orderToken as string,
    });
    expect(order).toMatchObject({
      lines: [
        {
          product: digitalInvitation.handle,
          quantity: 1,
          total: 24_900,
          event: { id: eventId, hosts: "Ana și Mihai" },
        },
      ],
      subtotal: 24_900,
      total: 24_900,
      // Nothing to make or send.
      status: "done",
    });
    expect(order).not.toHaveProperty("delivery");
    expect(order).not.toHaveProperty("address");
    expect((await inviteOf(t, eventId))?.unlocked).toMatchObject({
      by: "order",
      order: "J1001",
    });
    const [recorded] = await orders(t);
    if (!recorded) throw new Error("No order recorded");
    // Nothing travels, so the billing address is all the invoice has, its
    // county found from the postal code.
    expect(recorded.billing?.address).toEqual({
      name: "ANA POPESCU",
      line1: "Bulevardul Unirii 1",
      city: "București",
      county: "București",
      postalCode: "030167",
      country: "RO",
    });
    expect(noticeEmail(recorded, null).text).toContain(
      "Factură pe persoană fizică: ANA POPESCU\nAdresa de facturare:\nANA POPESCU\nBulevardul Unirii 1\nBucurești, 030167\n",
    );
    expect(noticeEmail(recorded, null).text).toContain(
      `  Pentru Ana și Mihai, evenimentul ${eventId}\n\nNimic de livrat`,
    );
    expect(confirmationEmail(recorded, null, [null]).text).toContain(
      "1 × Invitație digitală: 249,00 lei\n  Pentru Ana și Mihai",
    );
  });

  test("goes with printed invitations by courier, the address asked once", async () => {
    const { t, stripe } = await withInvitation();
    await t.mutation(api.cart.add, roses);
    await t.action(api.checkout.start, {
      token,
      language: "en",
      unlockNow: true,
    });
    const fields = Object.fromEntries(stripe.opened()[0]?.fields ?? []);
    expect(fields).toMatchObject({
      "line_items[0][price_data][product_data][description]":
        "For Ana and Mihai",
      "shipping_address_collection[allowed_countries][0]": "RO",
      "shipping_options[0][shipping_rate_data][display_name]":
        "Courier to your door",
      "shipping_options[0][shipping_rate_data][fixed_amount][amount]": "2500",
      "phone_number_collection[enabled]": "true",
    });
  });

  test("is paid for once the couple agrees to unlock it right away, which the order keeps", async () => {
    const { t, stripe } = await withInvitation();
    expect((await t.query(api.cart.get, { token }))?.unlockNow).toBe(true);
    for (const unlockNow of [undefined, false])
      await expectError(
        t.action(api.checkout.start, { token, language: "ro", unlockNow }),
        errors.unlockNowNeeded,
      );
    expect(stripe.opened()).toEqual([]);

    const agreed = new Date("2026-10-21T12:00:00Z");
    setSystemTime(agreed);
    await t.action(api.checkout.start, {
      token,
      language: "en",
      unlockNow: true,
    });
    setSystemTime(new Date("2026-10-21T12:05:00Z"));
    const session = stripe.pay(stripe.latest().id);
    await t.action(api.checkout.confirm, { session: session.id });
    const [order] = await orders(t);
    if (!order) throw new Error("No order recorded");
    expect(order.unlockNowAt).toBe(agreed.getTime());
    expect(confirmationEmail(order, null, [null]).text).toContain(
      "Before paying, you asked us to unlock the digital invitation right away, and acknowledged that once it's unlocked you can no longer withdraw from it within 14 days.",
    );
  });

  test("isn't paid for once the event's invitation is unlocked another way", async () => {
    const { t, eventId } = await withInvitation();
    await t.mutation(internal.invites.unlock.byHand, {
      event: eventId,
      note: "Transfer",
    });
    await expectError(
      t.action(api.checkout.start, { token, language: "ro" }),
      errors.cartNotReady,
    );
  });
});

describe("a paid order", () => {
  test("sends no emails without Resend, and says so in the logs", async () => {
    const setup = await withCart();
    const { t } = setup;
    const session = await paid(setup);
    const log = spyOn(console, "log").mockImplementation(() => {});
    try {
      await t.action(api.checkout.confirm, { session: session.id });
      await t.finishAllScheduledFunctions(() => {});
      const said = log.mock.calls.map((call) => String(call[0]));
      expect(said).toContain("Order J1001 paid in Stripe's test mode");
      expect(said).toContain(
        "Order J1001 sent no emails: RESEND_API_KEY isn't set",
      );
    } finally {
      log.mockRestore();
    }
  });

  /** An order as the checkout above records it. */
  async function recorded() {
    const setup = await withCart();
    const session = await paid(setup);
    await setup.t.action(api.checkout.confirm, { session: session.id });
    const [order] = await orders(setup.t);
    if (!order) throw new Error("No order recorded");
    return order;
  }

  test("is confirmed to the couple in the language they paid in", async () => {
    const order = await recorded();
    const link = "https://jolene.ro/orders/abc";
    const email = confirmationEmail(order, link, [null]);
    expect(email.subject).toBe("[Test] Comanda J1001 · Jolene");
    expect(email.text).toContain("Mulțumim, Ana!");
    expect(email.text).toContain(
      "Am primit comanda J1001 și plata de 390,00 lei.",
    );
    expect(email.text).toContain("Livrare (Curier la adresă): 25,00 lei");
    expect(email.text).toContain("Livrăm la:\nAna Popescu\n");
    expect(email.text).toContain("Cluj-Napoca, Cluj, 400000");
    expect(email.html).toContain(`href="${link}"`);

    const english = confirmationEmail(
      { ...order, language: "en", test: false },
      null,
      ["https://example.com/proof.png"],
    );
    expect(english.subject).toBe("Order J1001 · Jolene");
    expect(english.text).toContain(
      "We've received order J1001 and your payment of 390,00 lei.",
    );
    expect(english.html).toContain('src="https://example.com/proof.png"');
    expect(email.text).not.toContain("TVA");

    const withVat = { ...order, vat: 6769 };
    expect(confirmationEmail(withVat, link, [null]).text).toContain(
      "Total: 390,00 lei\nDin care TVA: 67,69 lei",
    );
    expect(
      confirmationEmail({ ...withVat, language: "en" }, link, [null]).text,
    ).toContain("Including VAT: 67,69 lei");
  });

  test("tells the couple who pick it up where, and that it's free", async () => {
    const order = await recorded();
    const pickup = {
      ...order,
      delivery: {
        key: "pickup" as const,
        label: "Ridicare de la atelier, Str. Ion Creangă 41, Iași",
        price: 0,
      },
      total: subtotal,
    };
    const email = confirmationEmail(pickup, null, [null]);
    expect(email.text).toContain(
      "Livrare (Ridicare de la atelier, Str. Ion Creangă 41, Iași): gratuit",
    );
    expect(email.text).toContain(
      "Ridicați comanda de la atelier:\nStr. Ion Creangă 41, Iași\nVă anunțăm când e gata de ridicat.",
    );
    expect(email.text).not.toContain("Livrăm la");
    expect(email.html).toContain(
      "<strong>Ridicați comanda de la atelier</strong><br>Str. Ion Creangă 41, Iași<br>",
    );
    expect(
      confirmationEmail({ ...pickup, language: "en" }, null, [null]).text,
    ).toContain(
      "Pick up your order from the workshop:\nStr. Ion Creangă 41, Iași\nWe'll let you know when it's ready.",
    );

    // Free by courier, from 800 lei: still to their address.
    const free = confirmationEmail(
      {
        ...order,
        delivery: {
          key: "courier",
          label: "Curier la adresă",
          price: 0,
        },
      },
      null,
      [null],
    );
    expect(free.text).toContain("Livrare (Curier la adresă): gratuit");
    expect(free.text).toContain("Livrăm la:");

    const notice = noticeEmail(pickup, null).text;
    expect(notice).toContain(
      "Ridicare de la atelier (Str. Ion Creangă 41, Iași): nu se livrează.\nAdresa clientului:\nAna Popescu",
    );
    expect(notice).not.toContain("Adresa:");
  });

  test("tells the team everything the workshop needs", async () => {
    const order = await recorded();
    const notice = noticeEmail(order, null);
    expect(notice.subject).toBe(
      "[Test] Comandă nouă J1001 · 390,00 lei · ANA POPESCU",
    );
    expect(notice.text).toContain(
      "Client: ANA POPESCU · ana@example.com · +40712345678",
    );
    expect(notice.text).toContain("Adresa:\nAna Popescu");
    expect(notice.text).toContain(
      "Factură pe persoană fizică: ANA POPESCU\nAdresa de facturare: aceeași cu cea de mai sus",
    );
    expect(notice.text).not.toContain("Județul lipsește");
    expect(notice.text).not.toContain("Ridicare");
    expect(notice.text).toContain("  Text personalizat: Ana și Mihai");
    expect(notice.text).toContain(`Plata în Stripe: ${order.paymentIntent}`);
    expect(notice.text).not.toContain("TVA");
  });

  test("tells the team when the invoice's address has no county", async () => {
    const order = await recorded();
    if (!order.billing) throw new Error("No billing details");
    const { county: _, ...address } = order.billing.address;
    const notice = noticeEmail(
      {
        ...order,
        billing: { address: { ...address, line1: "Strada Mare 3" } },
      },
      null,
    ).text;
    expect(notice).toContain(
      "Adresa de facturare:\nANA POPESCU\nStrada Mare 3\nAp. 2\nCluj-Napoca, 400000\nJudețul lipsește din adresa de facturare: completați-l pe factură.",
    );
  });

  test("tells the team when Stripe Tax put no VAT in it", async () => {
    const order = await recorded();
    expect(noticeEmail({ ...order, vat: 6769 }, null).text).toContain(
      "Din care TVA: 67,69 lei",
    );
    expect(noticeEmail({ ...order, vat: 0 }, null).text).toContain(
      "Stripe Tax n-a pus TVA în comandă",
    );
  });
});

describe("paidSession", () => {
  const session = {
    id: "cs_test_1",
    object: "checkout.session",
    status: "complete",
    payment_status: "paid",
    client_reference_id: "checkout",
    metadata: { checkout: "checkout" },
    livemode: true,
    amount_subtotal: 1000,
    amount_total: 1000,
    total_details: { amount_discount: 0 },
    customer_details: { name: "Ana", email: "ana@example.com", phone: null },
    collected_information: null,
    shipping_cost: null,
    payment_intent: "pi_1",
  } as unknown as Stripe.Checkout.Session;

  test("reads who paid and what Stripe charged", () => {
    expect(paidSession(session)).toEqual({
      id: "cs_test_1",
      checkout: "checkout",
      paymentIntent: "pi_1",
      test: false,
      customer: { name: "Ana", email: "ana@example.com" },
      subtotal: 1000,
      discount: 0,
      total: 1000,
    });
  });

  test("reads the VAT Stripe Tax found, only when it was on", () => {
    const taxed = {
      ...session,
      automatic_tax: { enabled: true, status: "complete" },
      total_details: { amount_discount: 0, amount_tax: 174 },
    } as unknown as Stripe.Checkout.Session;
    expect(paidSession(taxed)?.vat).toBe(174);
    expect(
      paidSession({
        ...taxed,
        automatic_tax: { ...taxed.automatic_tax, enabled: false },
      }),
    ).not.toHaveProperty("vat");
  });

  test("names the way the order travels by the rate Convex offered", () => {
    const delivery = (metadata: Record<string, string>) =>
      paidSession({
        ...session,
        shipping_cost: {
          amount_total: 2500,
          shipping_rate: {
            id: "shr_1",
            object: "shipping_rate",
            display_name: "Curier la adresă",
            metadata,
          },
        },
      } as unknown as Stripe.Checkout.Session)?.delivery;
    expect(delivery({ delivery: "courier" })).toEqual({
      key: "courier",
      label: "Curier la adresă",
      price: 2500,
    });
    // A rate Convex didn't make, as one from Stripe's Dashboard.
    const others: Record<string, string>[] = [{}, { delivery: "drone" }];
    for (const metadata of others)
      expect(delivery(metadata)).toEqual({
        label: "Curier la adresă",
        price: 2500,
      });
  });

  test("is null until Stripe has the money, and for a session no checkout opened", () => {
    expect(paidSession({ ...session, payment_status: "unpaid" })).toBeNull();
    expect(paidSession({ ...session, status: "open" })).toBeNull();
    expect(paidSession({ ...session, client_reference_id: null })).toBeNull();
    // A reference the buyer set, as a Payment Link's address can.
    expect(paidSession({ ...session, metadata: {} })).toBeNull();
    expect(
      paidSession({ ...session, metadata: { checkout: "another" } }),
    ).toBeNull();
  });
});

describe("lei", () => {
  test("writes bani as Romanian shops write prices", () => {
    expect(lei(0)).toBe("0,00 lei");
    expect(lei(5)).toBe("0,05 lei");
    expect(lei(38_500)).toBe("385,00 lei");
    expect(lei(123_456_789)).toBe("1.234.567,89 lei");
    expect(lei(-3650)).toBe("-36,50 lei");
  });
});
