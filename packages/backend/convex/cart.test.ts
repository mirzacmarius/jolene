import { describe, expect, test } from "bun:test";
import { Glob } from "bun";
import { convexTest } from "convex-test";
import { api, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import schema from "./schema";
import { errors } from "./utils/errors";

// convex-test loads the functions from this map, as Vite's import.meta.glob
// would build it.
const modules = Object.fromEntries(
  [...new Glob("**/*.ts").scanSync(import.meta.dir)]
    .filter((path) => !path.endsWith(".test.ts"))
    .map((path) => [`./${path}`, () => import(`./${path}`)]),
);

const token = "a".repeat(40);
const otherToken = "b".repeat(40);

/** Classic Roses' invitation: 6,30 lei, from 30, with paid papers and choices. */
const roses = {
  token,
  handle: "invitatie-de-nunta-classic-roses",
  quantity: 30,
  options: [{ name: "Carton", value: "Ivory texturat 300 gr" }],
  answers: [
    { key: "culoare-sigiliu", value: "Alb" },
    { key: "panglica", value: "Panglică mătase" },
    { key: "text-personalizat", value: "  Ana și Mihai  " },
  ],
  fees: ["diacritice-50"],
};

async function seeded() {
  const t = convexTest(schema, modules);
  await t.action(internal.init.seed, {});
  return t;
}

const expectError = async (promise: Promise<unknown>, code: string) =>
  expect(promise).rejects.toMatchObject({ data: code });

describe("cart.add", () => {
  test("prices a line from its paper, its paid choices and the order's fees", async () => {
    const t = await seeded();
    await t.mutation(api.cart.add, roses);
    const cart = await t.query(api.cart.get, { token });
    // 6,30 lei, 1 leu for the paper, 1,50 for the seal and 1,70 for the ribbon.
    expect(cart?.lines).toMatchObject([
      {
        handle: roses.handle,
        quantity: 30,
        minQuantity: 30,
        options: roses.options,
        answers: [
          { label: "Culoare sigiliu", value: "Alb" },
          { label: "Panglică", value: "Panglică mătase" },
          { label: "Text personalizat", value: "Ana și Mihai" },
        ],
        price: 1050,
        total: 31_500,
        problems: [],
      },
    ]);
    expect(cart?.fees).toEqual([
      { key: "diacritice-50", label: "Diacritice", price: 5000 },
    ]);
    expect(cart?.total).toBe(36_500);
    expect(cart?.count).toBe(1);
  });

  test("adds to the line that asks the same, and starts one for new choices", async () => {
    const t = await seeded();
    await t.mutation(api.cart.add, roses);
    await t.mutation(api.cart.add, { ...roses, quantity: 10 });
    await t.mutation(api.cart.add, {
      ...roses,
      options: [{ name: "Carton", value: "Alb mat 300 gr" }],
    });
    const cart = await t.query(api.cart.get, { token });
    expect(cart?.lines.map((line) => line.quantity)).toEqual([40, 30]);
    // Diacritics are paid once, however many lines ask for them.
    expect(cart?.fees).toHaveLength(1);
  });

  test("refuses what the product doesn't offer", async () => {
    const t = await seeded();
    const invalid = [
      { ...roses, options: [{ name: "Culoare", value: "Roșu" }] },
      { ...roses, answers: [{ key: "gravura", value: "Da" }] },
      { ...roses, fees: ["comanda-urgenta"] },
      { ...roses, quantity: 0 },
      { ...roses, quantity: 1000 },
      { ...roses, quantity: 1.5 },
    ];
    for (const line of invalid)
      await expectError(t.mutation(api.cart.add, line), errors.invalidLine);
    await expectError(
      t.mutation(api.cart.add, { ...roses, handle: "nowhere" }),
      errors.productUnavailable,
    );
    expect(await t.query(api.cart.get, { token })).toBeNull();
  });

  test("refuses a token short enough to guess", async () => {
    const t = await seeded();
    await expectError(
      t.mutation(api.cart.add, { ...roses, token: "short" }),
      errors.notFound,
    );
    expect(await t.query(api.cart.get, { token: "short" })).toBeNull();
  });

  test("carries a proof of the product, and refuses one of another", async () => {
    const t = await seeded();
    const template = await t.run((ctx) =>
      ctx.db
        .query("templates")
        .filter((q) => q.eq(q.field("shopifyProductHandle"), roses.handle))
        .first(),
    );
    if (!template) throw new Error("Classic Roses' invitation is a template");
    const ownerId = await t.run((ctx) =>
      ctx.db.insert("users", { isAnonymous: true }),
    );
    // Convex Auth's subject is the user id and the session id.
    const designId = await t
      .withIdentity({ subject: `${ownerId}|session` })
      .mutation(api.designs.start, { template: template.slug });
    const proofId = await t.run((ctx) =>
      ctx.db.insert("proofs", {
        designId,
        ownerId,
        templateId: template._id,
        kind: template.kind,
        revision: 0,
        document: template.document,
        fields: {},
        approvedAt: Date.UTC(2026, 9, 21),
      }),
    );
    await t.mutation(api.cart.add, { ...roses, proofId });
    const cart = await t.query(api.cart.get, { token });
    expect(cart?.lines[0]?.proof).toMatchObject({
      id: proofId,
      product: roses.handle,
      approvedAt: Date.UTC(2026, 9, 21),
    });
    await expectError(
      t.mutation(api.cart.add, {
        ...roses,
        handle: "18207",
        options: [],
        answers: [{ key: "text-personalizat", value: "Luna" }],
        quantity: 20,
        proofId,
      }),
      errors.invalidLine,
    );
  });
});

describe("cart.get", () => {
  test("says what stops a line being ordered", async () => {
    const t = await seeded();
    await t.mutation(api.cart.add, {
      ...roses,
      quantity: 10,
      answers: [{ key: "culoare-sigiliu", value: "Alb" }],
    });
    await t.run(async (ctx) => {
      const option = await ctx.db
        .query("lineOptions")
        .withIndex("by_handle", (q) => q.eq("handle", "culoare-sigiliu"))
        .unique();
      if (option)
        await ctx.db.patch("lineOptions", option._id, {
          choices: option.choices.filter((choice) => choice.label !== "Alb"),
        });
    });
    const cart = await t.query(api.cart.get, { token });
    expect(cart?.lines[0]?.problems).toEqual([
      { kind: "changed", label: "Culoare sigiliu" },
      { kind: "missing", label: "Text personalizat" },
      { kind: "minimum", minQuantity: 30 },
    ]);
  });

  test("marks a line whose product went off sale", async () => {
    const t = await seeded();
    await t.mutation(api.cart.add, roses);
    await t.run(async (ctx) => {
      const product = await ctx.db
        .query("products")
        .withIndex("by_handle", (q) => q.eq("handle", roses.handle))
        .unique();
      if (product)
        await ctx.db.patch("products", product._id, { published: false });
    });
    const cart = await t.query(api.cart.get, { token });
    expect(cart?.lines[0]?.problems).toEqual([{ kind: "unavailable" }]);
  });
});

describe("cart.setQuantity and cart.remove", () => {
  test("change the cart's own lines only", async () => {
    const t = await seeded();
    await t.mutation(api.cart.add, roses);
    await t.mutation(api.cart.add, { ...roses, token: otherToken });
    const lineId = (await t.query(api.cart.get, { token }))?.lines[0]
      ?.id as Id<"cartLines">;

    await expectError(
      t.mutation(api.cart.setQuantity, {
        token: otherToken,
        lineId,
        quantity: 50,
      }),
      errors.notFound,
    );
    await t.mutation(api.cart.setQuantity, { token, lineId, quantity: 50 });
    expect((await t.query(api.cart.get, { token }))?.lines[0]?.quantity).toBe(
      50,
    );

    await expectError(
      t.mutation(api.cart.remove, { token: otherToken, lineId }),
      errors.notFound,
    );
    await t.mutation(api.cart.setQuantity, { token, lineId, quantity: 0 });
    expect((await t.query(api.cart.get, { token }))?.lines).toEqual([]);
    expect(
      (await t.query(api.cart.get, { token: otherToken }))?.lines,
    ).toHaveLength(1);
  });
});
