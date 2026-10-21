import {
  afterEach,
  beforeEach,
  describe,
  expect,
  setSystemTime,
  spyOn,
  test,
} from "bun:test";
import Stripe from "stripe";
import { testConvex } from "../test/convex";
import { fakeStripe } from "../test/stripe";
import { api, internal } from "./_generated/api";
import type { Doc } from "./_generated/dataModel";
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
  await setup.t.action(api.checkout.start, { token, language: "ro" });
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

    const [request] = stripe.requests;
    const fields = Object.fromEntries(request?.fields ?? []);
    const checkouts = await t.run((ctx) => ctx.db.query("checkouts").take(5));
    expect(checkouts).toHaveLength(1);
    const checkout = checkouts[0] as Doc<"checkouts">;
    expect(request?.headers.get("idempotency-key")).toBe(
      `checkout-${checkout._id}`,
    );
    expect(fields).toMatchObject({
      mode: "payment",
      client_reference_id: checkout._id,
      locale: "ro",
      "line_items[0][quantity]": "30",
      "line_items[0][price_data][currency]": "ron",
      "line_items[0][price_data][unit_amount]": "1050",
      "line_items[0][price_data][product_data][description]":
        "Carton: Ivory texturat 300 gr",
      "line_items[1][quantity]": "1",
      "line_items[1][price_data][unit_amount]": "5000",
      "line_items[1][price_data][product_data][name]": "Diacritice",
      "shipping_address_collection[allowed_countries][0]": "RO",
      "shipping_options[0][shipping_rate_data][fixed_amount][amount]": "2000",
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
  });

  test("speaks the couple's language on Stripe's page", async () => {
    const { t, stripe } = await withCart();
    await t.action(api.checkout.start, { token, language: "en" });
    expect(stripe.requests[0]?.fields.get("locale")).toBe("en");
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
      delivery: { label: "Curier, la adresă", price: 2000 },
      discount: 0,
      total: subtotal + 2000,
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
    });
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
      total: subtotal - 3650 + 2000,
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
        delivery: { label: "Curier, la adresă", price: 2000 },
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
        delivery: { label: "Curier, la adresă", price: 2000 },
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
      "Am primit comanda J1001 și plata de 385,00 lei.",
    );
    expect(email.text).toContain("Livrare (Curier, la adresă): 20,00 lei");
    expect(email.text).toContain("Cluj-Napoca, Cluj, 400000");
    expect(email.html).toContain(`href="${link}"`);

    const english = confirmationEmail(
      { ...order, language: "en", test: false },
      null,
      ["https://example.com/proof.png"],
    );
    expect(english.subject).toBe("Order J1001 · Jolene");
    expect(english.text).toContain(
      "We've received order J1001 and your payment of 385,00 lei.",
    );
    expect(english.html).toContain('src="https://example.com/proof.png"');
  });

  test("tells the team everything the workshop needs", async () => {
    const order = await recorded();
    const notice = noticeEmail(order, null);
    expect(notice.subject).toBe(
      "[Test] Comandă nouă J1001 · 385,00 lei · ANA POPESCU",
    );
    expect(notice.text).toContain(
      "Client: ANA POPESCU · ana@example.com · +40712345678",
    );
    expect(notice.text).toContain("  Text personalizat: Ana și Mihai");
    expect(notice.text).toContain(`Plata în Stripe: ${order.paymentIntent}`);
  });
});

describe("paidSession", () => {
  const session = {
    id: "cs_test_1",
    object: "checkout.session",
    status: "complete",
    payment_status: "paid",
    client_reference_id: "checkout",
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

  test("is null until Stripe has the money, and for a session no checkout opened", () => {
    expect(paidSession({ ...session, payment_status: "unpaid" })).toBeNull();
    expect(paidSession({ ...session, status: "open" })).toBeNull();
    expect(paidSession({ ...session, client_reference_id: null })).toBeNull();
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
