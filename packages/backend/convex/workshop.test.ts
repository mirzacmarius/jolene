import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { suites } from "@jolene/suites";
import { testConvex } from "../test/convex";
import { api, internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
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
    });
    expect(await workshop.query(api.workshop.access, {})).toEqual({
      signedIn: true,
      email: "atelier@jolene.ro",
      allowed: true,
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
      key: "cargus",
      label: "Curier Cargus, la adresă",
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
