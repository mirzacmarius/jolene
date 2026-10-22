import {
  afterEach,
  beforeEach,
  describe,
  expect,
  type Mock,
  spyOn,
  test,
} from "bun:test";
import { suites } from "@jolene/suites";
import { coleteOnlineClient, fakeColeteOnline } from "../test/coleteOnline";
import { testConvex } from "../test/convex";
import { fakeStripe } from "../test/stripe";
import { api, internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { pickupReadyEmail, shipmentEmail } from "./orders/emails";
import { orderName, orderNumber } from "./orders/format";
import type { OrderLine } from "./orders/validators";

const workshopEnv = ["WORKSHOP_EMAILS", "SITE_URL"] as const;

beforeEach(() => {
  Object.assign(process.env, {
    WORKSHOP_EMAILS: " Atelier@Jolene.ro, marius@example.com",
    SITE_URL: "https://www.orvibo.it/studio",
  });
});

// The functions read the environment through the same process.env object.
afterEach(() => {
  for (const name of workshopEnv) Reflect.deleteProperty(process.env, name);
});

const roses = suites.find((suite) => suite.slug === "classic-roses");

/** The catalog, a couple's approved invitation, and who signs in. */
async function setUp() {
  const t = testConvex();
  await t.action(internal.init.seed, {});
  const signIn = async (user: {
    email?: string;
    emailVerificationTime?: number;
  }) => {
    const userId = await t.run((ctx) => ctx.db.insert("users", user));
    // Convex Auth's subject is the user id and the session id.
    return t.withIdentity({ subject: `${userId}|session` });
  };
  const couple = await signIn({});
  const designId = await couple.mutation(api.designs.start, {
    template: "classic-roses-invitatie",
  });
  const approved = await couple.mutation(api.proofs.approve, {
    designId,
    revision: 1,
    fields: {},
  });
  if (!approved.ok) throw new Error("not approved");
  await t.run(async (ctx) => {
    await ctx.db.patch("proofs", approved.proofId, {
      fields: { partner1: "Ana", partner2: "Mihai", date: "2027-06-12" },
    });
  });
  return {
    t,
    couple,
    proofId: approved.proofId,
    workshop: await signIn({
      email: "atelier@jolene.ro",
      emailVerificationTime: 1,
    }),
    signIn,
  };
}

/** 60 designed invitations and 60 menus, as a couple paid for them. */
function lines(proofId: Id<"proofs">): OrderLine[] {
  return [
    {
      product: "invitatie-de-nunta-classic-roses",
      title: "Invitație de nuntă Classic Roses",
      quantity: 60,
      options: [{ name: "Carton", value: "Ivory texturat 300 gr" }],
      answers: [
        { key: "culoare-sigiliu", label: "Culoare sigiliu", value: "Alb" },
      ],
      proof: proofId,
      price: 1050,
      total: 63_000,
    },
    {
      product: "meniu-nunta-classic-roses",
      title: "Meniu nuntă Classic Roses",
      quantity: 60,
      options: [],
      answers: [],
      price: 500,
      total: 30_000,
    },
  ];
}

/** Records a paid order, numbered from J1001 as checkout numbers them. */
async function order(
  t: ReturnType<typeof testConvex>,
  number: number,
  orderLines: OrderLine[],
  // Null for an order with nothing to deliver.
  delivery: Doc<"orders">["delivery"] | null = {
    label: "Curier, la adresă",
    price: 2000,
  },
) {
  await t.run((ctx) =>
    ctx.db.insert("orders", {
      number,
      token: `${number}`.padEnd(32, "x"),
      session: `cs_test_${number}`,
      paymentIntent: `pi_${number}`,
      test: false,
      language: "ro",
      lines: orderLines,
      fees: [{ key: "diacritice-50", label: "Diacritice", price: 5000 }],
      subtotal: 98_000,
      ...(delivery && { delivery }),
      discount: 0,
      total: 100_000,
      vat: 15_966,
      customer: {
        name: "Ana Popescu",
        email: "ana@example.com",
        phone: "+40722000000",
      },
      address: {
        name: "Ana Popescu",
        line1: "Strada Florilor 1",
        city: "Cluj-Napoca",
        county: "Cluj",
        postalCode: "400000",
        country: "RO",
      },
      paidAt: Date.UTC(2026, 9, 21, 12) + number,
    }),
  );
}

describe("orderNumber", () => {
  test("reads the number in an order's name, as its address has it", () => {
    expect(orderNumber(orderName(1001))).toBe(1001);
    expect(orderNumber(" j1234 ")).toBe(1234);
    for (const name of ["1001", "J", "J10", "J1001a", "#1001", "J1e3"])
      expect(orderNumber(name)).toBeNull();
  });
});

describe("the workshop", () => {
  test("opens to the accounts on its list", async () => {
    const { couple, workshop, signIn } = await setUp();
    expect(await couple.query(api.workshop.access, {})).toEqual({
      signedIn: false,
      google: null,
    });
    expect(await workshop.query(api.workshop.access, {})).toEqual({
      signedIn: true,
      email: "atelier@jolene.ro",
      listed: true,
      allowed: true,
      google: null,
    });
    const stranger = await signIn({
      email: "someone@example.com",
      emailVerificationTime: 1,
    });
    expect(await stranger.query(api.workshop.access, {})).toMatchObject({
      allowed: false,
    });
    // An address no code was sent to counts for nothing.
    const unverified = await signIn({ email: "marius@example.com" });
    expect(await unverified.query(api.workshop.access, {})).toMatchObject({
      allowed: false,
    });
    for (const visitor of [couple, stranger, unverified]) {
      await expect(
        visitor.query(api.workshop.orders, {
          paginationOpts: { numItems: 10, cursor: null },
        }),
      ).rejects.toThrow("workshop-only");
      await expect(
        visitor.query(api.workshop.order, { number: 1001 }),
      ).rejects.toThrow("workshop-only");
      await expect(
        visitor.query(api.workshop.printJob, { number: 1001, line: 0 }),
      ).rejects.toThrow("workshop-only");
      await expect(
        visitor.mutation(api.workshop.setStatus, {
          number: 1001,
          from: "paid",
          status: "making",
        }),
      ).rejects.toThrow("workshop-only");
      await expect(
        visitor.mutation(api.workshop.addNote, { number: 1001, note: "Hi" }),
      ).rejects.toThrow("workshop-only");
      await expect(
        visitor.action(api.workshop.refund, { number: 1001, amount: 100 }),
      ).rejects.toThrow("workshop-only");
    }
  });

  test("opens to no one while its list is empty", async () => {
    const { workshop } = await setUp();
    Reflect.deleteProperty(process.env, "WORKSHOP_EMAILS");
    expect(await workshop.query(api.workshop.access, {})).toMatchObject({
      allowed: false,
    });
  });

  test("lists the orders newest first, a page at a time", async () => {
    const { t, workshop, proofId } = await setUp();
    await order(t, 1001, lines(proofId));
    await order(t, 1002, lines(proofId), {
      key: "pickup",
      label: "Ridicare de la atelier, Str. Ion Creangă 41, Iași",
      price: 0,
    });
    await order(t, 1003, lines(proofId), {
      key: "courier",
      label: "Curier la adresă",
      price: 2500,
    });
    const first = await workshop.query(api.workshop.orders, {
      paginationOpts: { numItems: 2, cursor: null },
    });
    expect(first.page.map((row) => row.name)).toEqual(["J1003", "J1002"]);
    expect(first.isDone).toBe(false);
    expect(first.page[0]).toEqual({
      number: 1003,
      name: "J1003",
      paidAt: Date.UTC(2026, 9, 21, 12) + 1003,
      test: false,
      customer: "Ana Popescu",
      city: "Cluj-Napoca",
      pickup: false,
      lines: [
        { title: "Invitație de nuntă Classic Roses", quantity: 60 },
        { title: "Meniu nuntă Classic Roses", quantity: 60 },
      ],
      total: 100_000,
      status: "paid",
      refunded: 0,
    });
    // Picked up from the workshop, wherever the couple lives.
    expect(first.page[1]).toMatchObject({ city: "Cluj-Napoca", pickup: true });
    const rest = await workshop.query(api.workshop.orders, {
      paginationOpts: { numItems: 2, cursor: first.continueCursor },
    });
    expect(rest.page.map((row) => row.name)).toEqual(["J1001"]);
    expect(rest.isDone).toBe(true);
  });

  test("shows an order with its proof, what was chosen, and where it goes", async () => {
    const { t, workshop, proofId } = await setUp();
    await order(t, 1001, lines(proofId));
    expect(
      await workshop.query(api.workshop.order, { number: 1002 }),
    ).toBeNull();
    const shown = await workshop.query(api.workshop.order, { number: 1001 });
    expect(shown).toMatchObject({
      number: 1001,
      name: "J1001",
      test: false,
      language: "ro",
      fees: [{ key: "diacritice-50", label: "Diacritice", price: 5000 }],
      delivery: { label: "Curier, la adresă", price: 2000 },
      total: 100_000,
      vat: 15_966,
      customer: { name: "Ana Popescu", phone: "+40722000000" },
      address: { city: "Cluj-Napoca", county: "Cluj" },
      page: `https://www.orvibo.it/orders/${"1001".padEnd(32, "x")}`,
      payment: "https://dashboard.stripe.com/payments/pi_1001",
      status: "paid",
      statuses: ["paid", "making", "sent", "done", "cancelled"],
      history: [],
      refunded: 0,
      refunds: [],
    });
    const [invitation, menu] = shown?.lines ?? [];
    expect(invitation).toMatchObject({
      title: "Invitație de nuntă Classic Roses",
      quantity: 60,
      options: [{ name: "Carton", value: "Ivory texturat 300 gr" }],
      answers: [{ label: "Culoare sigiliu", value: "Alb" }],
      total: 63_000,
      proof: { id: proofId, kind: "invitation", suite: roses?.name },
    });
    expect(menu).not.toHaveProperty("proof");
    expect(menu?.image).toEqual({
      url: expect.stringMatching(/^https:\/\//),
      alt: expect.any(String),
    });
  });

  test("links a test order's payment to Stripe's test mode", async () => {
    const { t, workshop, proofId } = await setUp();
    await order(t, 1001, lines(proofId));
    await t.run(async (ctx) => {
      const recorded = await ctx.db.query("orders").first();
      if (recorded) await ctx.db.patch("orders", recorded._id, { test: true });
    });
    expect(
      await workshop.query(api.workshop.order, { number: 1001 }),
    ).toMatchObject({
      test: true,
      payment: "https://dashboard.stripe.com/test/payments/pi_1001",
    });
  });

  test("says when a line's proof is gone", async () => {
    const { t, workshop, proofId } = await setUp();
    await order(t, 1001, lines(proofId));
    await t.run((ctx) => ctx.db.delete("proofs", proofId));
    const shown = await workshop.query(api.workshop.order, { number: 1001 });
    expect(shown?.lines[0]?.proof).toBeNull();
    expect(
      await workshop.query(api.workshop.printJob, { number: 1001, line: 0 }),
    ).toBeNull();
  });

  test("gives a designed line's print file what the couple approved", async () => {
    const { t, workshop, proofId } = await setUp();
    await order(t, 1001, lines(proofId));
    const job = await workshop.query(api.workshop.printJob, {
      number: 1001,
      line: 0,
    });
    expect(job).toMatchObject({
      order: "J1001",
      quantity: 60,
      kind: "invitation",
      suite: roses?.name,
      names: "Ana & Mihai",
      fields: { partner1: "Ana", partner2: "Mihai", date: "2027-06-12" },
      document: { kind: "invitation", occasion: "wedding" },
    });
    expect(job?.assets.length).toBeGreaterThan(0);
    for (const asset of job?.assets ?? [])
      expect(asset.url).toStartWith("/studio/art/classic-roses/");
    // The menu wasn't designed, and the order has no third line.
    for (const line of [1, 2])
      expect(
        await workshop.query(api.workshop.printJob, { number: 1001, line }),
      ).toBeNull();
    expect(
      await workshop.query(api.workshop.printJob, { number: 1002, line: 0 }),
    ).toBeNull();
  });
});

describe("an order's status", () => {
  const pickup = {
    key: "pickup" as const,
    label: "Ridicare de la atelier, Str. Ion Creangă 41, Iași",
    price: 0,
  };

  test("moves on as the workshop marks it, into its history", async () => {
    const { t, workshop, proofId } = await setUp();
    await order(t, 1001, lines(proofId));
    await order(t, 1002, lines(proofId));
    for (const [from, status] of [
      ["paid", "making"],
      ["making", "sent"],
    ] as const)
      await workshop.mutation(api.workshop.setStatus, {
        number: 1001,
        from,
        status,
      });
    const shown = await workshop.query(api.workshop.order, { number: 1001 });
    expect(shown?.status).toBe("sent");
    expect(shown?.history).toEqual([
      {
        id: expect.any(String),
        at: expect.any(Number),
        by: "atelier@jolene.ro",
        kind: "status",
        from: "making",
        status: "sent",
      },
      {
        id: expect.any(String),
        at: expect.any(Number),
        by: "atelier@jolene.ro",
        kind: "status",
        from: "paid",
        status: "making",
      },
    ]);
    // Each status lists its own orders, newest first.
    const listed = async (status?: "paid" | "sent" | "done") =>
      (
        await workshop.query(api.workshop.orders, {
          paginationOpts: { numItems: 10, cursor: null },
          ...(status && { status }),
        })
      ).page.map((row) => `${row.name} ${row.status}`);
    // Orders paid before statuses get theirs from the seed.
    await t.mutation(internal.workshop.statuses.backfill, {});
    expect(await listed("sent")).toEqual(["J1001 sent"]);
    expect(await listed("paid")).toEqual(["J1002 paid"]);
    expect(await listed("done")).toEqual([]);
    expect(await listed()).toEqual(["J1002 paid", "J1001 sent"]);
  });

  test("changes only from what the workshop's page showed", async () => {
    const { t, workshop, proofId } = await setUp();
    await order(t, 1001, lines(proofId));
    const move = { number: 1001, from: "paid", status: "making" } as const;
    await workshop.mutation(api.workshop.setStatus, move);
    // Someone else's page still showed it paid.
    await expect(
      workshop.mutation(api.workshop.setStatus, move),
    ).rejects.toThrow("order-moved");
    // A courier brings it: it's sent, never ready to pick up.
    await expect(
      workshop.mutation(api.workshop.setStatus, {
        number: 1001,
        from: "making",
        status: "ready",
      }),
    ).rejects.toThrow("invalid-input");
    await expect(
      workshop.mutation(api.workshop.setStatus, { ...move, number: 1002 }),
    ).rejects.toThrow("not-found");
    const shown = await workshop.query(api.workshop.order, { number: 1001 });
    expect(shown?.status).toBe("making");
    expect(shown?.history).toHaveLength(1);
  });

  test("is ready to pick up for a pickup, and done for nothing to deliver", async () => {
    const { t, workshop, proofId } = await setUp();
    await order(t, 1001, lines(proofId), pickup);
    await order(t, 1002, lines(proofId), null);
    const picked = await workshop.query(api.workshop.order, { number: 1001 });
    expect(picked?.statuses).toEqual([
      "paid",
      "making",
      "ready",
      "done",
      "cancelled",
    ]);
    const digital = await workshop.query(api.workshop.order, { number: 1002 });
    expect(digital).toMatchObject({
      status: "done",
      statuses: ["done", "cancelled"],
    });
    await workshop.mutation(api.workshop.setStatus, {
      number: 1002,
      from: "done",
      status: "cancelled",
    });
    await expect(
      workshop.mutation(api.workshop.setStatus, {
        number: 1002,
        from: "cancelled",
        status: "making",
      }),
    ).rejects.toThrow("invalid-input");
  });

  test("keeps the workshop's notes beside it", async () => {
    const { t, workshop, signIn, proofId } = await setUp();
    await order(t, 1001, lines(proofId));
    await workshop.mutation(api.workshop.addNote, {
      number: 1001,
      note: "  Hârtie comandată, vine joi.  ",
    });
    const marius = await signIn({
      email: "marius@example.com",
      emailVerificationTime: 1,
    });
    await marius.mutation(api.workshop.addNote, {
      number: 1001,
      note: "Clientul a sunat.",
    });
    const shown = await workshop.query(api.workshop.order, { number: 1001 });
    expect(shown?.history).toEqual([
      {
        id: expect.any(String),
        at: expect.any(Number),
        by: "marius@example.com",
        kind: "note",
        note: "Clientul a sunat.",
      },
      {
        id: expect.any(String),
        at: expect.any(Number),
        by: "atelier@jolene.ro",
        kind: "note",
        note: "Hârtie comandată, vine joi.",
      },
    ]);
    for (const note of ["   ", "x".repeat(2001)])
      await expect(
        workshop.mutation(api.workshop.addNote, { number: 1001, note }),
      ).rejects.toThrow("invalid-input");
  });
});

describe("a refund", () => {
  let stripe: ReturnType<typeof fakeStripe> | undefined;

  beforeEach(() => {
    process.env.STRIPE_SECRET_KEY = "sk_test_jolene";
  });

  afterEach(() => {
    stripe?.restore();
    stripe = undefined;
    Reflect.deleteProperty(process.env, "STRIPE_SECRET_KEY");
  });

  /** An order of 1.000 lei the couple paid through Stripe. */
  async function paidOrder() {
    const setup = await setUp();
    await order(setup.t, 1001, lines(setup.proofId));
    stripe = fakeStripe();
    stripe.charge("pi_1001", 100_000);
    return { ...setup, stripe };
  }

  test("gives back part of a payment, then the rest, and no more", async () => {
    const { workshop, stripe } = await paidOrder();
    await workshop.action(api.workshop.refund, {
      number: 1001,
      amount: 30_000,
    });
    const [asked] = stripe.refundsAsked();
    expect(Object.fromEntries(asked?.fields ?? [])).toEqual({
      payment_intent: "pi_1001",
      amount: "30000",
      reason: "requested_by_customer",
      "metadata[order]": "J1001",
      "metadata[by]": "atelier@jolene.ro",
    });
    expect(asked?.headers.get("idempotency-key")).toStartWith("refund-");
    expect(
      await workshop.query(api.workshop.order, { number: 1001 }),
    ).toMatchObject({
      refunded: 30_000,
      refunds: [
        {
          id: expect.any(String),
          at: expect.any(Number),
          amount: 30_000,
          status: "succeeded",
          by: "atelier@jolene.ro",
        },
      ],
    });
    // More than is left, nothing, or a fraction of a ban.
    for (const amount of [70_001, 0, -100, 10.5])
      await expect(
        workshop.action(api.workshop.refund, { number: 1001, amount }),
      ).rejects.toThrow("invalid-input");
    await workshop.action(api.workshop.refund, {
      number: 1001,
      amount: 70_000,
    });
    const shown = await workshop.query(api.workshop.order, { number: 1001 });
    expect(shown?.refunded).toBe(100_000);
    expect(shown?.refunds.map((refund) => refund.amount)).toEqual([
      70_000, 30_000,
    ]);
    const listed = await workshop.query(api.workshop.orders, {
      paginationOpts: { numItems: 1, cursor: null },
    });
    expect(listed.page[0]?.refunded).toBe(100_000);
    await expect(
      workshop.action(api.workshop.refund, { number: 1001, amount: 1 }),
    ).rejects.toThrow("invalid-input");
    await expect(
      workshop.action(api.workshop.refund, { number: 1002, amount: 1 }),
    ).rejects.toThrow("not-found");
    expect(stripe.refundsAsked()).toHaveLength(2);
  });

  test("gives back once when the button is pressed twice", async () => {
    const { workshop, stripe } = await paidOrder();
    const press = () =>
      workshop.action(api.workshop.refund, { number: 1001, amount: 30_000 });
    await Promise.all([press(), press()]);
    expect(stripe.refundsAsked()).toHaveLength(2);
    expect(stripe.refunds.size).toBe(1);
    const shown = await workshop.query(api.workshop.order, { number: 1001 });
    expect(shown?.refunded).toBe(30_000);
    expect(shown?.refunds).toHaveLength(1);
  });

  test("tells a colleague who gives the same back at once that it's done", async () => {
    const { workshop, signIn, stripe } = await paidOrder();
    const marius = await signIn({
      email: "marius@example.com",
      emailVerificationTime: 1,
    });
    const [first, second] = await Promise.allSettled(
      [workshop, marius].map((account) =>
        account.action(api.workshop.refund, { number: 1001, amount: 30_000 }),
      ),
    );
    expect(first?.status).toBe("fulfilled");
    expect(second).toMatchObject({
      status: "rejected",
      reason: { data: "same-refund" },
    });
    expect(stripe.refunds.size).toBe(1);
  });

  test("says when Stripe's key may not refund, or Stripe won't", async () => {
    const { t, workshop, proofId, stripe } = await paidOrder();
    // Stripe doesn't know this payment, as for a test order on a live key.
    await order(t, 1002, lines(proofId));
    const warn = spyOn(console, "warn").mockImplementation(() => {});
    await expect(
      workshop.action(api.workshop.refund, { number: 1002, amount: 100 }),
    ).rejects.toThrow("refund-refused");
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("J1002"));
    warn.mockRestore();
    stripe.forbidRefunds();
    await expect(
      workshop.action(api.workshop.refund, { number: 1001, amount: 100 }),
    ).rejects.toThrow("refund-not-allowed");
    for (const number of [1001, 1002])
      expect(
        await workshop.query(api.workshop.order, { number }),
      ).toMatchObject({ refunded: 0, refunds: [] });
  });

  test("reverses the order's invoice once all of it is given back", async () => {
    const { t, workshop } = await paidOrder();
    const orderId = await t.run(async (ctx) => {
      const paid = await ctx.db
        .query("orders")
        .withIndex("by_number", (q) => q.eq("number", 1001))
        .unique();
      if (!paid) throw new Error("No order J1001");
      await ctx.db.patch("orders", paid._id, {
        invoice: { status: "issued", at: 1, series: "JOL", number: "0042" },
      });
      return paid._id;
    });
    const reversals = () =>
      t.run(async (ctx) =>
        (await ctx.db.system.query("_scheduled_functions").collect())
          .filter((job) => job.name === "invoices:reverse")
          .map((job) => job.args),
      );
    await workshop.action(api.workshop.refund, {
      number: 1001,
      amount: 30_000,
    });
    expect(await reversals()).toEqual([]);
    await workshop.action(api.workshop.refund, {
      number: 1001,
      amount: 70_000,
    });
    expect(await reversals()).toEqual([[{ orderId }]]);
  });
});

describe("sending an order", () => {
  const courier = {
    key: "courier" as const,
    label: "Curier la adresă",
    price: 2500,
  };
  const pickup = {
    key: "pickup" as const,
    label: "Ridicare de la atelier, Str. Ion Creangă 41, Iași",
    price: 0,
  };
  const sendingEnv = [
    "COLETE_ONLINE_CLIENT_ID",
    "COLETE_ONLINE_CLIENT_SECRET",
    "CONVEX_SITE_URL",
    "SMARTBILL_USERNAME",
    "SMARTBILL_TOKEN",
    "SMARTBILL_SERIES",
  ] as const;
  let colete: ReturnType<typeof fakeColeteOnline> | undefined;
  let log: Mock<typeof console.log>;
  let warn: Mock<typeof console.warn>;

  beforeEach(() => {
    log = spyOn(console, "log").mockImplementation(() => {});
    warn = spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    colete?.restore();
    colete = undefined;
    log.mockRestore();
    warn.mockRestore();
    for (const name of sendingEnv) Reflect.deleteProperty(process.env, name);
  });

  /** Colete Online's keys on the deployment, and its fake answering. */
  function coleteOnline() {
    Object.assign(process.env, {
      COLETE_ONLINE_CLIENT_ID: coleteOnlineClient.id,
      COLETE_ONLINE_CLIENT_SECRET: coleteOnlineClient.secret,
      CONVEX_SITE_URL: "https://jolene-test.convex.site",
    });
    colete = fakeColeteOnline();
    return colete;
  }

  /** The subjects of the couple's emails, as the logs have them while none goes out. */
  const emailed = () =>
    log.mock.calls.flatMap((call) => {
      const subject = /email "(.*)" went by no email/.exec(String(call[0]));
      return subject ? [subject[1]] : [];
    });

  async function stored(t: ReturnType<typeof testConvex>, number: number) {
    const order = await t.run((ctx) =>
      ctx.db
        .query("orders")
        .withIndex("by_number", (q) => q.eq("number", number))
        .unique(),
    );
    if (!order) throw new Error(`No order ${number}`);
    return order;
  }

  test("books the courier for the box the team packed, and moves the order on to sent", async () => {
    const { t, workshop, proofId } = await setUp();
    coleteOnline();
    await order(t, 1001, lines(proofId), courier);
    await workshop.mutation(api.workshop.setStatus, {
      number: 1001,
      from: "paid",
      status: "making",
    });
    expect(
      (await workshop.query(api.workshop.order, { number: 1001 }))
        ?.courierBooking,
    ).toBe(true);
    const parcel = { weight: 2.5, length: 40, width: 30, height: 10 };
    await workshop.mutation(api.workshop.bookCourier, {
      number: 1001,
      from: "making",
      parcel,
    });
    await t.finishAllScheduledFunctions(() => {});
    const shown = await workshop.query(api.workshop.order, { number: 1001 });
    expect(shown?.status).toBe("sent");
    expect(shown?.history[0]).toMatchObject({
      by: "atelier@jolene.ro",
      kind: "status",
      from: "making",
      status: "sent",
    });
    expect(
      await workshop.query(api.shipments.forWorkshop, { number: 1001 }),
    ).toMatchObject({
      status: "booked",
      parcel,
      courier: "Cargus",
      awb: "1000000001",
      label: expect.any(String),
    });
    // The booking tells the couple, once; the change of status doesn't.
    const sent = await stored(t, 1001);
    expect(emailed()).toEqual([
      shipmentEmail(sent, { courier: "Cargus", awb: "1000000001" }, null)
        .subject,
    ]);
    await expect(
      workshop.mutation(api.workshop.bookCourier, {
        number: 1001,
        from: "sent",
      }),
    ).rejects.toThrow("shipment-booked");
  });

  test("says why Colete Online refused, and books again", async () => {
    const { t, workshop, proofId } = await setUp();
    const fake = coleteOnline();
    await order(t, 1001, lines(proofId), courier);
    fake.fail("order", {
      status: 422,
      body: {
        message: "The given data was invalid.",
        errors: { "recipient.contact.phone": ["Numărul nu e valid."] },
      },
    });
    await workshop.mutation(api.workshop.bookCourier, {
      number: 1001,
      from: "paid",
    });
    await t.finishAllScheduledFunctions(() => {});
    expect(
      await workshop.query(api.shipments.forWorkshop, { number: 1001 }),
    ).toMatchObject({
      status: "failed",
      parcel: { weight: 1, length: 35, width: 25, height: 5 },
      error:
        "Colete Online a răspuns 422: The given data was invalid. Numărul nu e valid.",
    });
    // The team asked for it to go: it stays sent while they book again.
    expect(
      (await workshop.query(api.workshop.order, { number: 1001 }))?.status,
    ).toBe("sent");
    expect(emailed()).toEqual([]);
    fake.recover("order");
    await workshop.mutation(api.workshop.bookCourier, {
      number: 1001,
      from: "sent",
    });
    await t.finishAllScheduledFunctions(() => {});
    expect(
      await workshop.query(api.shipments.forWorkshop, { number: 1001 }),
    ).toMatchObject({ status: "booked", awb: "1000000001" });
    const shown = await workshop.query(api.workshop.order, { number: 1001 });
    expect(shown?.history.filter((entry) => entry.kind === "status")).toEqual([
      expect.objectContaining({ from: "paid", status: "sent" }),
    ]);
  });

  test("records a courier the team booked itself, and corrects its AWB", async () => {
    const { t, workshop, proofId } = await setUp();
    await order(t, 1001, lines(proofId), courier);
    expect(
      (await workshop.query(api.workshop.order, { number: 1001 }))
        ?.courierBooking,
    ).toBe(false);
    // Without Colete Online's keys, the team types the AWB in.
    await expect(
      workshop.mutation(api.workshop.bookCourier, {
        number: 1001,
        from: "paid",
      }),
    ).rejects.toThrow("courier-unavailable");
    await workshop.mutation(api.workshop.recordAwb, {
      number: 1001,
      from: "paid",
      courier: " Sameday ",
      awb: "4EMG 1234 5678",
    });
    expect(
      await workshop.query(api.shipments.forWorkshop, { number: 1001 }),
    ).toMatchObject({
      status: "booked",
      courier: "Sameday",
      awb: "4EMG12345678",
    });
    await workshop.mutation(api.workshop.recordAwb, {
      number: 1001,
      from: "sent",
      courier: "Sameday",
      awb: "4EMG12345679",
    });
    const shown = await workshop.query(api.workshop.order, { number: 1001 });
    expect(shown?.status).toBe("sent");
    expect(
      shown?.history.filter((entry) => entry.kind === "status"),
    ).toHaveLength(1);
    expect(
      await workshop.query(api.shipments.forWorkshop, { number: 1001 }),
    ).toMatchObject({ awb: "4EMG12345679" });
    // The couple heard of each AWB.
    expect(emailed()).toHaveLength(2);
    for (const typed of [
      { courier: "", awb: "   " },
      { courier: "", awb: "1".repeat(101) },
      { courier: "x".repeat(101), awb: "123" },
    ])
      await expect(
        workshop.mutation(api.workshop.recordAwb, {
          number: 1001,
          from: "sent",
          ...typed,
        }),
      ).rejects.toThrow("invalid-input");
  });

  test("sends nothing from a page the order moved on from, nor a cancelled order or one picked up", async () => {
    const { t, workshop, couple, proofId } = await setUp();
    coleteOnline();
    await order(t, 1001, lines(proofId), courier);
    await order(t, 1002, lines(proofId), pickup);
    await workshop.mutation(api.workshop.setStatus, {
      number: 1001,
      from: "paid",
      status: "making",
    });
    // Someone else's page still showed it paid.
    await expect(
      workshop.mutation(api.workshop.bookCourier, {
        number: 1001,
        from: "paid",
      }),
    ).rejects.toThrow("order-moved");
    await expect(
      workshop.mutation(api.workshop.recordAwb, {
        number: 1001,
        from: "paid",
        courier: "",
        awb: "123",
      }),
    ).rejects.toThrow("order-moved");
    await workshop.mutation(api.workshop.setStatus, {
      number: 1001,
      from: "making",
      status: "cancelled",
    });
    await expect(
      workshop.mutation(api.workshop.bookCourier, {
        number: 1001,
        from: "cancelled",
      }),
    ).rejects.toThrow("invalid-input");
    expect(
      await workshop.query(api.shipments.forWorkshop, { number: 1001 }),
    ).toBeNull();
    // No courier takes an order the couple picks up, and it stays as it was.
    await expect(
      workshop.mutation(api.workshop.bookCourier, {
        number: 1002,
        from: "paid",
      }),
    ).rejects.toThrow("invalid-input");
    await expect(
      workshop.mutation(api.workshop.recordAwb, {
        number: 1002,
        from: "paid",
        courier: "",
        awb: "123",
      }),
    ).rejects.toThrow("invalid-input");
    const pickedUp = await workshop.query(api.workshop.order, { number: 1002 });
    expect(pickedUp?.status).toBe("paid");
    expect(pickedUp?.history).toEqual([]);
    await expect(
      couple.mutation(api.workshop.bookCourier, { number: 1002, from: "paid" }),
    ).rejects.toThrow("workshop-only");
    await expect(
      couple.mutation(api.workshop.recordAwb, {
        number: 1002,
        from: "paid",
        courier: "",
        awb: "123",
      }),
    ).rejects.toThrow("workshop-only");
  });

  test("tells the couple their order is ready to pick up", async () => {
    const { t, workshop, proofId } = await setUp();
    await order(t, 1001, lines(proofId), pickup);
    await workshop.mutation(api.workshop.setStatus, {
      number: 1001,
      from: "paid",
      status: "making",
    });
    expect(emailed()).toEqual([]);
    await workshop.mutation(api.workshop.setStatus, {
      number: 1001,
      from: "making",
      status: "ready",
    });
    expect(emailed()).toEqual([
      pickupReadyEmail(await stored(t, 1001), null).subject,
    ]);
  });

  test("shows the order's invoice and its credit note, with their PDFs", async () => {
    const { t, workshop, proofId } = await setUp();
    await order(t, 1001, lines(proofId));
    expect(
      await workshop.query(api.workshop.order, { number: 1001 }),
    ).toMatchObject({ invoicing: false, courierBooking: false });
    const file = await t.run((ctx) =>
      ctx.storage.store(
        new Blob(["%PDF-1.4 JOL 0042"], { type: "application/pdf" }),
      ),
    );
    const { _id } = await stored(t, 1001);
    await t.run((ctx) =>
      ctx.db.patch("orders", _id, {
        invoice: {
          status: "issued",
          at: 1,
          series: "JOL",
          number: "0042",
          file,
        },
        creditNote: {
          status: "failed",
          at: 2,
          error: "SmartBill a răspuns 400: Factura nu poate fi stornată.",
        },
      }),
    );
    Object.assign(process.env, {
      SMARTBILL_USERNAME: "atelier@jolene.ro",
      SMARTBILL_TOKEN: "smartbill-token",
      SMARTBILL_SERIES: "JOL",
    });
    const shown = await workshop.query(api.workshop.order, { number: 1001 });
    expect(shown?.invoicing).toBe(true);
    expect(shown?.invoice).toEqual({
      status: "issued",
      at: 1,
      name: "JOL 0042",
      url: expect.any(String),
    });
    expect(shown?.creditNote).toEqual({
      status: "failed",
      at: 2,
      error: "SmartBill a răspuns 400: Factura nu poate fi stornată.",
    });
  });
});

describe("the workshop's settings", () => {
  test("keep guest lists 12 months until the team saves another number", async () => {
    const { t, workshop } = await setUp();
    expect(await workshop.query(api.workshop.settings.get, {})).toEqual({
      guestListMonths: 12,
      minGuestListMonths: 12,
      maxGuestListMonths: 24,
      updatedBy: null,
      updatedAt: null,
    });
    await workshop.mutation(api.workshop.settings.setGuestListMonths, {
      months: 18,
    });
    expect(await workshop.query(api.workshop.settings.get, {})).toMatchObject({
      guestListMonths: 18,
      updatedBy: "atelier@jolene.ro",
    });
    await workshop.mutation(api.workshop.settings.setGuestListMonths, {
      months: 24,
    });
    const saved = await t.run((ctx) => ctx.db.query("settings").collect());
    expect(saved.map((settings) => settings.guestListMonths)).toEqual([24]);
    for (const months of [11, 25, 12.5])
      await expect(
        workshop.mutation(api.workshop.settings.setGuestListMonths, {
          months,
        }),
      ).rejects.toThrow("invalid-input");
  });

  test("open to the workshop alone", async () => {
    const { couple } = await setUp();
    await expect(couple.query(api.workshop.settings.get, {})).rejects.toThrow(
      "workshop-only",
    );
    await expect(
      couple.mutation(api.workshop.settings.setGuestListMonths, {
        months: 18,
      }),
    ).rejects.toThrow("workshop-only");
  });
});
