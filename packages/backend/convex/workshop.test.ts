import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { suites } from "@jolene/suites";
import { testConvex } from "../test/convex";
import { api, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
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
      delivery: { label: "Curier, la adresă", price: 2000 },
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
    for (const number of [1001, 1002, 1003])
      await order(t, number, lines(proofId));
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
      lines: [
        { title: "Invitație de nuntă Classic Roses", quantity: 60 },
        { title: "Meniu nuntă Classic Roses", quantity: 60 },
      ],
      total: 100_000,
    });
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
