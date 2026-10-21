import { describe, expect, test } from "bun:test";
import { digitalInvitation } from "@jolene/products/digital-invitation";
import { testConvex } from "../test/convex";
import { api, internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { errors } from "./utils/errors";

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
  const t = testConvex();
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

describe("the digital invitation", () => {
  /** A couple's wedding, as the studio keeps it. */
  const wedding = (t: Awaited<ReturnType<typeof seeded>>) =>
    t.run(async (ctx) =>
      ctx.db.insert("events", {
        ownerId: await ctx.db.insert("users", { isAnonymous: true }),
        occasion: "wedding",
        fields: { partner1: "Ana", partner2: "Mihai", date: "2027-06-12" },
        updatedAt: Date.now(),
      }),
    );

  const unlockByHand = (t: Awaited<ReturnType<typeof seeded>>, event: string) =>
    t.mutation(internal.invites.unlock.byHand, { event, note: "Transfer" });

  const forEvent = (eventId?: string) => ({
    token,
    handle: digitalInvitation.handle,
    quantity: 1,
    options: [],
    answers: [],
    fees: [],
    eventId,
  });

  test("takes one for each event, with whose invitation it is", async () => {
    const t = await seeded();
    const eventId = await wedding(t);
    await t.mutation(api.cart.add, forEvent(eventId));
    await t.mutation(api.cart.add, forEvent(eventId));
    const cart = await t.query(api.cart.get, { token });
    expect(cart?.lines).toMatchObject([
      {
        handle: digitalInvitation.handle,
        title: digitalInvitation.title,
        quantity: 1,
        price: digitalInvitation.price * 100,
        total: digitalInvitation.price * 100,
        event: {
          id: eventId,
          occasion: "wedding",
          hosts: { ro: "Ana și Mihai", en: "Ana and Mihai" },
          date: "2027-06-12",
          image: null,
          unlocked: false,
        },
        problems: [],
      },
    ]);

    const lineId = cart?.lines[0]?.id as Id<"cartLines">;
    await expectError(
      t.mutation(api.cart.setQuantity, { token, lineId, quantity: 2 }),
      errors.invalidLine,
    );
    await t.mutation(api.cart.add, forEvent(await wedding(t)));
    expect(
      (await t.query(api.cart.get, { token }))?.lines.map(
        (line) => line.quantity,
      ),
    ).toEqual([1, 1]);
  });

  test("refuses it without its event, or with one already unlocked", async () => {
    const t = await seeded();
    const eventId = await wedding(t);
    for (const line of [
      forEvent(),
      forEvent("nothing"),
      { ...forEvent(eventId), quantity: 2 },
      { ...roses, eventId },
    ])
      await expectError(t.mutation(api.cart.add, line), errors.invalidLine);
    expect(await unlockByHand(t, eventId)).toBe(true);
    await expectError(
      t.mutation(api.cart.add, forEvent(eventId)),
      errors.inviteUnlocked,
    );
    expect(await t.query(api.cart.get, { token })).toBeNull();
  });

  test("shows the invitation its guests see, once the couple published it", async () => {
    const t = await seeded();
    const template = await t.run((ctx) => ctx.db.query("templates").first());
    if (!template) throw new Error("The studio has templates");
    const ownerId = await t.run((ctx) =>
      ctx.db.insert("users", { isAnonymous: true }),
    );
    const designId = await t
      .withIdentity({ subject: `${ownerId}|session` })
      .mutation(api.designs.start, { template: template.slug });
    const design = await t.run(
      async (ctx) => (await ctx.db.get("designs", designId)) as Doc<"designs">,
    );
    const picture = await t.run(async (ctx) => {
      const image = await ctx.storage.store(new Blob(["card"]));
      await ctx.db.insert("invites", {
        eventId: design.eventId,
        slug: "ana-si-mihai",
        language: "ro",
        published: {
          designId,
          revision: design.revision,
          document: design.document,
          image,
          at: Date.now(),
        },
        open: true,
        questions: { meals: [], allergies: false },
        updatedAt: Date.now(),
      });
      return await ctx.storage.getUrl(image);
    });
    await t.mutation(api.cart.add, forEvent(design.eventId));
    const [line] = (await t.query(api.cart.get, { token }))?.lines ?? [];
    expect(picture).toBeString();
    expect(line?.event?.image).toBe(picture);
    expect(line?.image?.url).toBe(picture as string);
  });

  test("says when the invitation was unlocked after it went in the cart", async () => {
    const t = await seeded();
    const eventId = await wedding(t);
    await t.mutation(api.cart.add, forEvent(eventId));
    await unlockByHand(t, eventId);
    const [line] = (await t.query(api.cart.get, { token }))?.lines ?? [];
    expect(line?.event?.unlocked).toBe(true);
    expect(line?.problems).toEqual([{ kind: "unlocked" }]);
  });

  test("comes free with the event's printed invitations in the same cart", async () => {
    const t = await seeded();
    const template = await t.run((ctx) =>
      ctx.db
        .query("templates")
        .filter((q) => q.eq(q.field("shopifyProductHandle"), roses.handle))
        .first(),
    );
    if (template?.kind !== "invitation")
      throw new Error("Classic Roses' invitation is an invitation's template");
    const ownerId = await t.run((ctx) =>
      ctx.db.insert("users", { isAnonymous: true }),
    );
    const designId = await t
      .withIdentity({ subject: `${ownerId}|session` })
      .mutation(api.designs.start, { template: template.slug });
    const design = await t.run(
      async (ctx) => (await ctx.db.get("designs", designId)) as Doc<"designs">,
    );
    const proofId = await t.run((ctx) =>
      ctx.db.insert("proofs", {
        designId,
        ownerId,
        templateId: template._id,
        kind: template.kind,
        revision: design.revision,
        document: design.document,
        fields: {},
        approvedAt: Date.now(),
      }),
    );
    const price = digitalInvitation.price * 100;
    const invitationLine = async () =>
      (await t.query(api.cart.get, { token }))?.lines.find(
        (line) => line.handle === digitalInvitation.handle,
      );

    await t.mutation(api.cart.add, forEvent(design.eventId));
    expect(await invitationLine()).toMatchObject({ price, total: price });
    expect(await invitationLine()).not.toHaveProperty("freeWithPrinted");

    // The invitations they print open it to every guest once paid for.
    await t.mutation(api.cart.add, { ...roses, proofId });
    expect(await invitationLine()).toMatchObject({
      freeWithPrinted: true,
      price: 0,
      compareAtPrice: price,
      total: 0,
      problems: [],
    });
    const cart = await t.query(api.cart.get, { token });
    const prints = cart?.lines.find((line) => line.handle === roses.handle);
    expect(cart?.total).toBe((prints?.total ?? 0) + 5_000);
    const checkout = await t.mutation(internal.checkout.prepare, {
      token,
      language: "ro",
    });
    expect(
      checkout.lines.find((line) => line.product === digitalInvitation.handle),
    ).toMatchObject({ price: 0, total: 0 });

    // Fewer than ten are a sample, which opens nothing.
    const printsId = prints?.id as Id<"cartLines">;
    await t.mutation(api.cart.setQuantity, {
      token,
      lineId: printsId,
      quantity: 9,
    });
    expect(await invitationLine()).toMatchObject({ price, total: price });
    await t.mutation(api.cart.remove, { token, lineId: printsId });
    expect(await invitationLine()).toMatchObject({ price, total: price });
  });

  test("costs as much beside another event's printed invitations", async () => {
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
    const designId = await t
      .withIdentity({ subject: `${ownerId}|session` })
      .mutation(api.designs.start, { template: template.slug });
    const proofId = await t.run(async (ctx) => {
      const design = (await ctx.db.get("designs", designId)) as Doc<"designs">;
      return await ctx.db.insert("proofs", {
        designId,
        ownerId,
        templateId: template._id,
        kind: template.kind,
        revision: design.revision,
        document: design.document,
        fields: {},
        approvedAt: Date.now(),
      });
    });
    await t.mutation(api.cart.add, { ...roses, proofId });
    await t.mutation(api.cart.add, forEvent(await wedding(t)));
    const line = (await t.query(api.cart.get, { token }))?.lines.find(
      (found) => found.handle === digitalInvitation.handle,
    );
    expect(line).toMatchObject({
      price: digitalInvitation.price * 100,
      total: digitalInvitation.price * 100,
    });
  });
});
