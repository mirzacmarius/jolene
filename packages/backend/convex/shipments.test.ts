import {
  afterEach,
  beforeEach,
  describe,
  expect,
  type Mock,
  spyOn,
  test,
} from "bun:test";
import { coleteOnlineClient, fakeColeteOnline } from "../test/coleteOnline";
import { testConvex } from "../test/convex";
import { fakeStripe } from "../test/stripe";
import { api, internal } from "./_generated/api";
import {
  pickupReadyEmail,
  shipmentEmail,
  shipmentNotice,
} from "./orders/emails";
import type { Parcel } from "./orders/validators";
import { recordPickupReady, recordShipment } from "./shipments";
import { bookingOf, streetOf, validParcel } from "./shipments/booking";
import { errors } from "./utils/errors";

const token = "s".repeat(40);

/** Classic Roses' invitation, 30 of them, as the cart takes them. */
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
  fees: [],
};

const shipmentEnv = [
  "SITE_URL",
  "SHOP_URL",
  "CONVEX_SITE_URL",
  "STRIPE_SECRET_KEY",
  "COLETE_ONLINE_CLIENT_ID",
  "COLETE_ONLINE_CLIENT_SECRET",
  "COLETE_ONLINE_ADDRESS_ID",
  "WORKSHOP_EMAILS",
] as const;

let stripe: ReturnType<typeof fakeStripe> | undefined;
let colete: ReturnType<typeof fakeColeteOnline> | undefined;
let log: Mock<typeof console.log>;
let warn: Mock<typeof console.warn>;

beforeEach(() => {
  Object.assign(process.env, {
    SITE_URL: "http://localhost:3024/studio",
    SHOP_URL: "https://jolene.ro",
    CONVEX_SITE_URL: "https://jolene-test.convex.site",
    STRIPE_SECRET_KEY: "sk_test_jolene",
    COLETE_ONLINE_CLIENT_ID: coleteOnlineClient.id,
    COLETE_ONLINE_CLIENT_SECRET: coleteOnlineClient.secret,
    WORKSHOP_EMAILS: "atelier@jolene.ro",
  });
  log = spyOn(console, "log").mockImplementation(() => {});
  warn = spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  // Colete Online's fake stands in front of Stripe's: it goes first.
  colete?.restore();
  colete = undefined;
  stripe?.restore();
  stripe = undefined;
  log.mockRestore();
  warn.mockRestore();
  for (const name of shipmentEnv) Reflect.deleteProperty(process.env, name);
});

/** The shop's catalog with roses in the cart, and Stripe and Colete Online standing by. */
async function shop() {
  const t = testConvex();
  await t.action(internal.init.seed, {});
  await t.mutation(api.cart.add, roses);
  stripe = fakeStripe();
  colete = fakeColeteOnline();
  return { t, stripe, colete };
}

type Shop = Awaited<ReturnType<typeof shop>>;

async function theOrder(t: Shop["t"]) {
  const order = await t.run((ctx) => ctx.db.query("orders").first());
  if (!order) throw new Error("No order recorded");
  return order;
}

/**
 * Pays for the cart on Stripe's page, in live mode unless `test`, by
 * courier unless `pickup`, and lets everything the order sets off run.
 */
async function pay({ t, stripe }: Shop, { test = false, pickup = false } = {}) {
  await t.action(api.checkout.start, {
    token,
    language: "ro",
    unlockNow: false,
  });
  const session = stripe.pay(stripe.latest().id, {
    delivery: pickup ? 1 : 0,
  });
  session.livemode = !test;
  await t.action(api.checkout.confirm, { session: session.id });
  await t.finishAllScheduledFunctions(() => {});
  return await theOrder(t);
}

/** Who the workshop's account is, signed in. */
async function workshop(t: Shop["t"]) {
  const userId = await t.run((ctx) =>
    ctx.db.insert("users", {
      email: "atelier@jolene.ro",
      emailVerificationTime: 1,
    }),
  );
  return t.withIdentity({ subject: `${userId}|session` });
}

/** Books the order's courier from the workshop, and lets the booking run. */
async function book(setup: Shop, { parcel }: { parcel?: Parcel } = {}) {
  const staff = await workshop(setup.t);
  await staff.mutation(api.shipments.book, {
    number: 1001,
    ...(parcel && { parcel }),
  });
  await setup.t.finishAllScheduledFunctions(() => {});
  return await theOrder(setup.t);
}

/** What the team was told, as the logs have it while no email goes out. */
const told = () => warn.mock.calls.map((call) => String(call[0]));
const logged = () => log.mock.calls.map((call) => String(call[0]));

/** The couple's email, as the logs have it while no email goes out. */
const emailed = (subject: string) =>
  `Order J1001's email "${subject}" went by no email: RESEND_API_KEY isn't set`;

describe("booking an order's courier", () => {
  test("books the cheapest courier in Colete Online, keeps its label and tells the couple", async () => {
    const setup = await shop();
    const order = await pay(setup);
    const booked = await book(setup);
    const { colete, t } = setup;

    // It signs in with the account's keys, then books from the saved address.
    const [signIn, ...again] = colete.calls("token");
    expect(again).toEqual([]);
    expect(Object.fromEntries(signIn?.form ?? [])).toEqual({
      grant_type: "client_credentials",
      client_id: "colete-client",
      client_secret: "colete-secret",
      scope: "*",
    });
    expect(colete.calls("address")).toMatchObject([
      { method: "GET", staging: false },
    ]);
    const [request, ...others] = colete.calls("order");
    expect(others).toEqual([]);
    expect(request?.method).toBe("POST");
    expect(request?.staging).toBe(false);
    expect(request?.headers.get("authorization")).toBe("Bearer token-1");
    const key = booked.shipment?.key ?? "";
    expect(key).toHaveLength(32);
    const hook = `https://jolene-test.convex.site/colete-online-webhook?${new URLSearchParams({ order: order._id, key })}`;
    expect(request?.body).toEqual({
      sender: { addressId: 4321 },
      recipient: {
        contact: {
          name: "Ana Popescu",
          phone: "0712345678",
          email: "ana@example.com",
        },
        address: {
          countryCode: "RO",
          postalCode: "400000",
          city: "Cluj-Napoca",
          county: "Cluj",
          street: "Strada Florilor",
          number: "1",
          additionalInfo: "Ap. 2",
        },
        validationStrategy: "minimal",
      },
      packages: {
        content: "Papetărie",
        type: 2,
        list: [{ weight: 1, length: 35, width: 25, height: 5 }],
      },
      service: { selectionType: "bestPrice" },
      extraOptions: [
        { id: 1, url: hook, secretKey: key },
        { id: 9, clientReference: "J1001" },
      ],
    });

    expect(booked.shipment).toMatchObject({
      status: "booked",
      parcel: { weight: 1, length: 35, width: 25, height: 5 },
      id: "CO000001",
      awb: "1000000001",
      courier: "Cargus",
      service: "Standard",
      price: 1815,
      pickupDate: "2026-10-23",
    });
    expect(booked.shipment?.error).toBeUndefined();
    expect(booked.shipment?.warning).toBeUndefined();

    // Its label is kept, as Colete Online printed it.
    expect(colete.calls("awb")).toMatchObject([
      { method: "GET", id: "CO000001", staging: false },
    ]);
    expect(colete.calls("awb")[0]?.headers.get("accept")).toBe(
      "application/pdf",
    );
    const file = booked.shipment?.label;
    if (!file) throw new Error("No label kept");
    expect(
      await t.run(async (ctx) => (await ctx.storage.get(file))?.text()),
    ).toBe("%PDF-1.4 AWB 1000000001");

    // The couple hear it's on its way, and their page shows the AWB.
    expect(logged()).toContain(
      emailed("Comanda J1001 pleacă spre voi · Jolene"),
    );
    const view = await t.query(api.orders.byToken, { token: order.token });
    expect(view?.shipment).toEqual({ courier: "Cargus", awb: "1000000001" });

    // The workshop sees the booking and its label, never its secret.
    const staff = await workshop(t);
    const seen = await staff.query(api.shipments.forWorkshop, {
      number: 1001,
    });
    expect(seen).toMatchObject({
      status: "booked",
      awb: "1000000001",
      courier: "Cargus",
      label: expect.any(String),
    });
    expect(seen).not.toHaveProperty("key");
    expect(told()).toEqual([]);
  });

  test("books a test order on Colete Online's staging API", async () => {
    const setup = await shop();
    await pay(setup, { test: true });
    const booked = await book(setup);
    for (const call of setup.colete.requests.filter((r) => r.call !== "token"))
      expect(call.staging).toBe(true);
    expect(booked.shipment).toMatchObject({
      status: "booked",
      id: "ST000001",
      awb: "9000000001",
    });
    expect(logged()).toContain(
      emailed("[Test] Comanda J1001 pleacă spre voi · Jolene"),
    );
  });

  test("collects from the saved address COLETE_ONLINE_ADDRESS_ID names", async () => {
    process.env.COLETE_ONLINE_ADDRESS_ID = " 99 ";
    const setup = await shop();
    setup.colete.addresses([{ locationId: 4321 }, { locationId: 99 }]);
    await pay(setup);
    const booked = await book(setup);
    expect(setup.colete.calls("address")).toEqual([]);
    expect(setup.colete.calls("order")[0]?.body?.sender).toEqual({
      addressId: 99,
    });
    expect(booked.shipment?.status).toBe("booked");
  });

  test("sends the parcel as the workshop packed it", async () => {
    const setup = await shop();
    await pay(setup);
    const parcel = { weight: 2.5, length: 40, width: 30, height: 10 };
    const booked = await book(setup, { parcel });
    expect(setup.colete.calls("order")[0]?.body?.packages).toMatchObject({
      list: [parcel],
    });
    expect(booked.shipment?.parcel).toEqual(parcel);
  });

  test("is only for the workshop, and only for a parcel a courier takes", async () => {
    const setup = await shop();
    const { t } = setup;
    await pay(setup);
    await expect(
      t.mutation(api.shipments.book, { number: 1001 }),
    ).rejects.toMatchObject({ data: errors.workshopOnly });
    const staff = await workshop(t);
    await expect(
      staff.mutation(api.shipments.book, { number: 1009 }),
    ).rejects.toMatchObject({ data: errors.notFound });
    for (const parcel of [
      { weight: 0, length: 35, width: 25, height: 5 },
      { weight: 32, length: 35, width: 25, height: 5 },
      { weight: 1, length: 201, width: 25, height: 5 },
    ])
      await expect(
        staff.mutation(api.shipments.book, { number: 1001, parcel }),
      ).rejects.toMatchObject({ data: errors.invalidInput });
    expect(setup.colete.requests).toEqual([]);
    expect((await theOrder(t)).shipment).toBeUndefined();
  });

  test("isn't for an order picked up from the workshop", async () => {
    const setup = await shop();
    await pay(setup, { pickup: true });
    const staff = await workshop(setup.t);
    await expect(
      staff.mutation(api.shipments.book, { number: 1001 }),
    ).rejects.toMatchObject({ data: errors.invalidInput });
  });

  test("isn't offered until Colete Online is set up", async () => {
    Reflect.deleteProperty(process.env, "COLETE_ONLINE_CLIENT_SECRET");
    const setup = await shop();
    await pay(setup);
    const staff = await workshop(setup.t);
    await expect(
      staff.mutation(api.shipments.book, { number: 1001 }),
    ).rejects.toMatchObject({ data: errors.courierUnavailable });
  });

  test("books once: again only after a refusal, or once a booking is stuck", async () => {
    const setup = await shop();
    const { t } = setup;
    const order = await pay(setup);
    await book(setup);
    const staff = await workshop(t);
    await expect(
      staff.mutation(api.shipments.book, { number: 1001 }),
    ).rejects.toMatchObject({ data: errors.shipmentBooked });

    // A booking asked for five minutes ago may still be on its way.
    const asked = (minutes: number) =>
      t.run((ctx) =>
        ctx.db.patch("orders", order._id, {
          shipment: {
            status: "booking",
            at: Date.now() - minutes * 60_000,
            key: "k".repeat(32),
          },
        }),
      );
    await asked(5);
    await expect(
      staff.mutation(api.shipments.book, { number: 1001 }),
    ).rejects.toMatchObject({ data: errors.shipmentBooked });

    // After a quarter of an hour it's stuck, and the workshop books again.
    await asked(16);
    await staff.mutation(api.shipments.book, { number: 1001 });
    await t.finishAllScheduledFunctions(() => {});
    const rebooked = await theOrder(t);
    expect(rebooked.shipment).toMatchObject({
      status: "booked",
      id: "CO000002",
    });
    expect(rebooked.shipment?.key).not.toBe("k".repeat(32));

    // The stuck booking's answer, coming late, changes nothing.
    await t.action(internal.shipments.create, {
      orderId: order._id,
      key: "k".repeat(32),
    });
    expect(setup.colete.calls("order")).toHaveLength(2);
    expect((await theOrder(t)).shipment).toEqual(rebooked.shipment);
  });

  test("is left to the team when Colete Online refuses it, until the workshop books again", async () => {
    const setup = await shop();
    setup.colete.fail("order", {
      status: 422,
      body: {
        message: "The given data was invalid.",
        errors: {
          "recipient.address.postalCode": ["Codul poștal nu e al localității."],
        },
      },
    });
    const order = await pay(setup);
    const refused = await book(setup);
    const error =
      "Colete Online a răspuns 422: The given data was invalid. Codul poștal nu e al localității.";
    expect(refused.shipment).toMatchObject({ status: "failed", error });
    const notice = shipmentNotice(
      order,
      { problem: error },
      `https://jolene.ro/orders/${order.token}`,
    );
    expect(notice.subject).toBe("Curierul comenzii J1001 · de verificat");
    expect(notice.text).toBe(
      [
        `Colete Online n-a comandat curierul comenzii J1001: ${error}`,
        "",
        "Comandați-l din nou din atelier sau direct în Colete Online.",
        "",
        "Livrăm la:",
        "Ana Popescu",
        "Strada Florilor 1",
        "Ap. 2",
        "Cluj-Napoca, Cluj, 400000",
        "Telefon: +40712345678",
        `Pagina comenzii: https://jolene.ro/orders/${order.token}`,
      ].join("\n"),
    );
    expect(told()).toContain(notice.text);
    expect(told()).toContain(`Order J1001's courier wasn't booked: ${error}`);
    expect(logged()).not.toContain(
      emailed("Comanda J1001 pleacă spre voi · Jolene"),
    );

    setup.colete.recover("order");
    const booked = await book(setup);
    expect(booked.shipment).toMatchObject({ status: "booked", id: "CO000001" });
    expect(booked.shipment?.error).toBeUndefined();
  });

  test("warns the team to look in Colete Online first when it didn't answer", async () => {
    const setup = await shop();
    // The gateway gave up, though Colete Online went ahead.
    setup.colete.fail("order", {
      status: 504,
      text: "Gateway Timeout",
      booked: true,
    });
    await pay(setup);
    const look =
      "Colete Online poate să-l fi comandat totuși: verificați în contul Colete Online înainte să-l comandați din nou.";
    expect((await book(setup)).shipment?.error).toBe(
      `Colete Online a răspuns 504: Gateway Timeout. ${look}`,
    );
    expect(setup.colete.bookings.size).toBe(1);

    setup.colete.fail("order", "unreachable");
    expect((await book(setup)).shipment?.error).toBe(
      `Colete Online n-a răspuns (TypeError: fetch failed). ${look}`,
    );
  });

  test("says which keys to check when Colete Online turns the account away", async () => {
    process.env.COLETE_ONLINE_CLIENT_SECRET = "an-old-secret";
    const setup = await shop();
    await pay(setup);
    expect((await book(setup)).shipment).toMatchObject({
      status: "failed",
      error:
        "Colete Online a refuzat contul: verificați COLETE_ONLINE_CLIENT_ID și COLETE_ONLINE_CLIENT_SECRET în Convex (Client authentication failed)",
    });
    expect(setup.colete.calls("order")).toEqual([]);
  });

  test("asks for the workshop's address when the account saved none", async () => {
    const setup = await shop();
    setup.colete.addresses([]);
    await pay(setup);
    expect((await book(setup)).shipment?.error).toBe(
      "Contul Colete Online n-are nicio adresă salvată de unde să ridice curierul: salvați adresa atelierului în Colete Online.",
    );
    expect(setup.colete.calls("order")).toEqual([]);
  });

  test("stays booked when its label can't be fetched, and the team hears of it", async () => {
    const setup = await shop();
    setup.colete.fail("awb", {
      status: 500,
      body: { message: "Server Error" },
    });
    await pay(setup);
    const booked = await book(setup);
    const warning =
      "Eticheta n-a putut fi luată din Colete Online (Colete Online a răspuns 500: Server Error): o găsiți în contul Colete Online.";
    expect(booked.shipment).toMatchObject({ status: "booked", warning });
    expect(booked.shipment?.label).toBeUndefined();
    expect(told().join("\n")).toContain(
      `Curierul comenzii J1001 e comandat în Colete Online (Cargus, AWB 1000000001), dar: ${warning}`,
    );
    // The couple hear of it all the same.
    expect(logged()).toContain(
      emailed("Comanda J1001 pleacă spre voi · Jolene"),
    );
  });
});

describe("a parcel's progress", () => {
  test("is asked of Colete Online when its webhook calls, and shows on the order's page", async () => {
    const setup = await shop();
    const { t, colete } = setup;
    const order = await pay(setup);
    const booked = await book(setup);
    const key = booked.shipment?.key ?? "";
    colete.progress("CO000001", {
      name: "Comandă înregistrată",
      at: Date.UTC(2026, 9, 22, 9),
      code: 1,
    });
    colete.progress("CO000001", {
      name: "Ridicat de curier",
      at: Date.UTC(2026, 9, 22, 14),
      code: 2,
    });

    const hook = (query: Record<string, string>) =>
      t.fetch(`/colete-online-webhook?${new URLSearchParams(query)}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ awb: "1000000001", status: "picked up" }),
      });
    expect((await hook({ order: order._id, key })).status).toBe(200);
    await t.finishAllScheduledFunctions(() => {});
    const tracked = await theOrder(t);
    expect(tracked.shipment?.tracking).toEqual({
      text: "Ridicat de curier",
      at: Date.UTC(2026, 9, 22, 14),
      code: 2,
    });
    expect(colete.calls("status")).toMatchObject([
      { method: "GET", id: "CO000001", staging: false },
    ]);
    const view = await t.query(api.orders.byToken, { token: order.token });
    expect(view?.shipment).toEqual({
      courier: "Cargus",
      awb: "1000000001",
      tracking: { text: "Ridicat de curier", at: Date.UTC(2026, 9, 22, 14) },
    });

    // An address no booking gave asks nothing.
    const strangers: Record<string, string>[] = [
      { order: order._id, key: "x".repeat(32) },
      { order: "not-an-order", key },
      { order: order._id },
    ];
    for (const query of strangers) expect((await hook(query)).status).toBe(404);
    await t.finishAllScheduledFunctions(() => {});
    expect(colete.calls("status")).toHaveLength(1);
  });

  test("keeps the latest word, whichever comes last", async () => {
    const setup = await shop();
    const { t } = setup;
    const order = await pay(setup);
    const key = (await book(setup)).shipment?.key ?? "";
    const tell = (text: string, hour: number) =>
      t.mutation(internal.shipments.tracked, {
        orderId: order._id,
        key,
        tracking: { text, at: Date.UTC(2026, 9, 22, hour) },
      });
    await tell("În tranzit", 18);
    await tell("Ridicat de curier", 14);
    expect((await theOrder(t)).shipment?.tracking?.text).toBe("În tranzit");
    await tell("Livrat", 20);
    expect((await theOrder(t)).shipment?.tracking?.text).toBe("Livrat");
  });

  test("is asked again when the workshop refreshes it", async () => {
    const setup = await shop();
    const { t, colete } = setup;
    await pay(setup);
    const staff = await workshop(t);
    // Nothing to ask about before the courier is booked.
    expect(await staff.mutation(api.shipments.refresh, { number: 1001 })).toBe(
      false,
    );
    await book(setup);
    colete.progress("CO000001", {
      name: "În tranzit",
      at: Date.UTC(2026, 9, 22, 18),
    });
    expect(await staff.mutation(api.shipments.refresh, { number: 1001 })).toBe(
      true,
    );
    await t.finishAllScheduledFunctions(() => {});
    expect((await theOrder(t)).shipment?.tracking).toEqual({
      text: "În tranzit",
      at: Date.UTC(2026, 9, 22, 18),
    });
    await expect(
      t.mutation(api.shipments.refresh, { number: 1001 }),
    ).rejects.toMatchObject({ data: errors.workshopOnly });
  });

  test("only goes to the logs when Colete Online can't say", async () => {
    const setup = await shop();
    const { t, colete } = setup;
    await pay(setup);
    await book(setup);
    colete.fail("status", "unreachable");
    const staff = await workshop(t);
    await staff.mutation(api.shipments.refresh, { number: 1001 });
    await t.finishAllScheduledFunctions(() => {});
    expect((await theOrder(t)).shipment?.tracking).toBeUndefined();
    expect(told()).toContain(
      "Order J1001's parcel wasn't tracked: Colete Online n-a răspuns (TypeError: fetch failed)",
    );
  });
});

describe("a courier the workshop booked itself", () => {
  test("is kept by its AWB, and the couple hear it's on its way", async () => {
    const setup = await shop();
    const { t } = setup;
    const order = await pay(setup);
    await t.run((ctx) =>
      recordShipment(ctx, order._id, {
        courier: " Sameday ",
        awb: "4EMG 123 456",
      }),
    );
    const typed = await theOrder(t);
    expect(typed.shipment).toMatchObject({
      status: "booked",
      courier: "Sameday",
      awb: "4EMG123456",
    });
    expect(typed.shipment?.id).toBeUndefined();
    expect(logged()).toContain(
      emailed("Comanda J1001 pleacă spre voi · Jolene"),
    );
    const view = await t.query(api.orders.byToken, { token: order.token });
    expect(view?.shipment).toEqual({ courier: "Sameday", awb: "4EMG123456" });

    // Typing it again corrects it; there's nothing to ask Colete Online.
    await t.run((ctx) =>
      recordShipment(ctx, order._id, { courier: "Sameday", awb: "4EMG123457" }),
    );
    expect((await theOrder(t)).shipment?.awb).toBe("4EMG123457");
    const staff = await workshop(t);
    expect(await staff.mutation(api.shipments.refresh, { number: 1001 })).toBe(
      false,
    );
    // Nor can Colete Online book it now.
    await expect(
      staff.mutation(api.shipments.book, { number: 1001 }),
    ).rejects.toMatchObject({ data: errors.shipmentBooked });
    expect(setup.colete.requests).toEqual([]);
  });

  test("doesn't replace a courier Colete Online booked, or is booking", async () => {
    const setup = await shop();
    const { t } = setup;
    const order = await pay(setup);
    const typed = { courier: "FAN Courier", awb: "2345678901" };
    await book(setup);
    await expect(
      t.run((ctx) => recordShipment(ctx, order._id, typed)),
    ).rejects.toMatchObject({ data: errors.shipmentBooked });

    // A refused booking leaves it to the workshop.
    await t.run((ctx) =>
      ctx.db.patch("orders", order._id, {
        shipment: {
          status: "failed",
          at: Date.now(),
          key: "k".repeat(32),
          error: "Colete Online a răspuns 422",
        },
      }),
    );
    await t.run((ctx) => recordShipment(ctx, order._id, typed));
    expect((await theOrder(t)).shipment).toMatchObject({
      status: "booked",
      ...typed,
    });
    expect((await theOrder(t)).shipment?.error).toBeUndefined();
  });

  test("needs its AWB", async () => {
    const setup = await shop();
    const order = await pay(setup);
    await expect(
      setup.t.run((ctx) =>
        recordShipment(ctx, order._id, { courier: "Cargus", awb: "  " }),
      ),
    ).rejects.toMatchObject({ data: errors.invalidInput });
    expect((await theOrder(setup.t)).shipment).toBeUndefined();
  });

  test("isn't for an order picked up from the workshop", async () => {
    const setup = await shop();
    const order = await pay(setup, { pickup: true });
    await expect(
      setup.t.run((ctx) =>
        recordShipment(ctx, order._id, { courier: "Cargus", awb: "1" }),
      ),
    ).rejects.toMatchObject({ data: errors.invalidInput });
  });
});

describe("the couple's emails", () => {
  test("say which courier brings the parcel, and its AWB", async () => {
    const setup = await shop();
    const order = await pay(setup);
    const page = `https://jolene.ro/orders/${order.token}`;
    const email = shipmentEmail(
      order,
      { courier: "Cargus", awb: "1000000001" },
      page,
    );
    expect(email.subject).toBe("Comanda J1001 pleacă spre voi · Jolene");
    expect(email.text).toBe(
      [
        "Ana, comanda J1001 e gata și pleacă spre voi cu Cargus.",
        "Numărul ei de urmărire (AWB) e 1000000001.",
        "O urmăriți cu el pe site-ul Cargus sau pe pagina comenzii.",
        "",
        `Vedeți comanda: ${page}`,
        "",
        "Jolene · jolene.ro",
      ].join("\n"),
    );
    expect(email.html).toContain(`href="${page}"`);
    const english = shipmentEmail(
      { ...order, language: "en", test: true },
      { courier: "", awb: "1000000001" },
      null,
    );
    expect(english.subject).toBe("[Test] Order J1001 is on its way · Jolene");
    expect(english.text).toBe(
      [
        "Ana, order J1001 is ready and on its way to you with the courier.",
        "Its tracking number (AWB) is 1000000001.",
        "Follow it with that number on the courier's website, or on your order's page.",
        "",
        "Jolene · jolene.ro",
      ].join("\n"),
    );
    expect(english.html).not.toContain("href=");
  });

  test("tell a couple picking up their order that it's ready", async () => {
    const setup = await shop();
    const { t } = setup;
    const order = await pay(setup, { pickup: true });
    await t.run((ctx) => recordPickupReady(ctx, order._id));
    const page = `https://jolene.ro/orders/${order.token}`;
    const email = pickupReadyEmail(order, page);
    expect(email.subject).toBe("Comanda J1001 e gata de ridicat · Jolene");
    expect(email.text).toBe(
      [
        "Ana, comanda J1001 e gata: o puteți ridica de la atelier, Str. Ion Creangă 41, Iași.",
        "Dacă vreți să ne spuneți când veniți, răspundeți la acest email.",
        "",
        `Vedeți comanda: ${page}`,
        "",
        "Jolene · jolene.ro",
      ].join("\n"),
    );
    expect(logged()).toContain(emailed(email.subject));
  });

  test("don't tell a couple their parcel is ready to pick up", async () => {
    const setup = await shop();
    const order = await pay(setup);
    log.mockClear();
    await setup.t.run((ctx) => recordPickupReady(ctx, order._id));
    expect(logged()).toEqual([]);
  });
});

describe("streetOf", () => {
  test("parts an address's first line into street, number and the rest", () => {
    expect(streetOf("Str. Florilor nr. 1, bl. A2, ap. 5")).toEqual({
      street: "Str. Florilor",
      number: "1",
      rest: "bl. A2, ap. 5",
    });
    expect(streetOf("Strada Florilor 1")).toEqual({
      street: "Strada Florilor",
      number: "1",
      rest: "",
    });
    expect(streetOf("Bulevardul Unirii 12A, sc. B")).toEqual({
      street: "Bulevardul Unirii",
      number: "12A",
      rest: "sc. B",
    });
    expect(streetOf("Calea Victoriei Nr 10 - 12")).toEqual({
      street: "Calea Victoriei",
      number: "10-12",
      rest: "",
    });
    expect(streetOf("Str. 1 Decembrie 1918 nr. 3")).toEqual({
      street: "Str. 1 Decembrie 1918",
      number: "3",
      rest: "",
    });
    // A village's house with no number stays whole.
    expect(streetOf("  Sat Valea Lupului ")).toEqual({
      street: "Sat Valea Lupului",
      number: "",
      rest: "",
    });
  });
});

describe("validParcel", () => {
  test("is up to 31.5 kg and 2 m a side", () => {
    const box = { weight: 1, length: 35, width: 25, height: 5 };
    expect(validParcel(box)).toBe(true);
    expect(validParcel({ ...box, weight: 31.5, length: 200 })).toBe(true);
    expect(validParcel({ ...box, weight: 31.6 })).toBe(false);
    expect(validParcel({ ...box, height: 0 })).toBe(false);
    expect(validParcel({ ...box, width: -1 })).toBe(false);
  });
});

describe("bookingOf", () => {
  test("goes without what the address leaves out, and dials a Romanian number as couriers do", async () => {
    const setup = await shop();
    const order = await pay(setup);
    const booking = bookingOf(
      {
        ...order,
        customer: { ...order.customer, phone: "+40 (745) 123-456" },
        address: {
          name: "",
          line1: "Sat Valea Lupului",
          city: "Valea Lupului",
          country: "RO",
        },
      },
      { weight: 1, length: 35, width: 25, height: 5 },
      4321,
      {
        url: "https://jolene-test.convex.site/colete-online-webhook",
        key: "k",
      },
    );
    expect(booking.recipient).toEqual({
      contact: {
        name: "ANA POPESCU",
        phone: "0745123456",
        email: "ana@example.com",
      },
      address: {
        countryCode: "RO",
        postalCode: "",
        city: "Valea Lupului",
        county: "",
        street: "Sat Valea Lupului",
        number: "",
        additionalInfo: "",
      },
      validationStrategy: "minimal",
    });
    expect(() =>
      bookingOf(
        { ...order, address: undefined },
        { weight: 1, length: 35, width: 25, height: 5 },
        4321,
        { url: "", key: "" },
      ),
    ).toThrow("Order 1001 goes to no address");
  });
});
