import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { catalog } from "@jolene/products/data";
import { photoUrl } from "@jolene/products/photos";
import { testConvex } from "../../test/convex";
import { api, internal } from "../_generated/api";

const workshopEnv = ["WORKSHOP_EMAILS", "SITE_URL"] as const;

beforeEach(() => {
  Object.assign(process.env, {
    WORKSHOP_EMAILS: "atelier@jolene.ro",
    SITE_URL: "https://www.orvibo.it/studio",
  });
});

// The functions read the environment through the same process.env object.
afterEach(() => {
  for (const name of workshopEnv) Reflect.deleteProperty(process.env, name);
});

const firstPage = { numItems: 1000, cursor: null };

/** Luna: 8,50 lei, from 20, in two categories, with no papers to choose. */
const LUNA = "18207";

/** A product whose papers cost more than its price, as jolene.ro sold it. */
const withPaper = catalog.products.find((product) =>
  product.options.some((option) =>
    option.values.some((value) => value.surcharge > 0),
  ),
);

/** The catalog, and who signs in: the workshop, and a couple. */
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
  return {
    t,
    couple: await signIn({}),
    workshop: await signIn({
      email: "atelier@jolene.ro",
      emailVerificationTime: 1,
    }),
  };
}

/** What the product page sends to save Luna as the seed left it. */
const luna = {
  handle: LUNA,
  editedAt: null,
  title: "Invitație botez Luna",
  price: 850,
  compareAtPrice: null,
  minQuantity: 20,
  surcharges: [],
  published: true,
};

describe("the workshop's products", () => {
  test("lists them in Jolene's order, a category's, or by name", async () => {
    const { workshop } = await setUp();
    const all = await workshop.query(api.workshop.products.list, {
      published: true,
      paginationOpts: { numItems: 3, cursor: null },
    });
    expect(all.page.map((product) => product.handle)).toEqual(
      catalog.products.slice(0, 3).map((product) => product.handle),
    );

    const christenings = await workshop.query(api.workshop.products.list, {
      published: true,
      category: "invitatii-botez",
      paginationOpts: firstPage,
    });
    const row = christenings.page.find((product) => product.handle === LUNA);
    expect(row).toEqual({
      handle: LUNA,
      title: "Invitație botez Luna",
      price: 850,
      compareAtPrice: undefined,
      minQuantity: 20,
      published: true,
      forEvent: false,
      image: {
        url: photoUrl(
          "https://jolene.ro/wp-content/uploads/2021/10/Jolene_Fotograf_Irina_Mocanu_53.jpg",
        ),
        alt: "Invitatie botez baiat",
      },
      categories: ["Invitații botez", "Invitații băieți"],
      editedAt: undefined,
    });
    expect(
      christenings.page.every((product) =>
        product.categories.includes("Invitații botez"),
      ),
    ).toBe(true);

    const found = await workshop.query(api.workshop.products.list, {
      published: true,
      category: "agende",
      search: " Luna ",
      paginationOpts: firstPage,
    });
    expect(found.page.map((product) => product.handle)).toContain(LUNA);
    expect(
      await workshop.query(api.workshop.products.categories, {}),
    ).toContainEqual({ handle: "invitatii-botez", title: "Invitații botez" });
  });

  test("shows one with its papers, its categories and its page", async () => {
    const { workshop } = await setUp();
    if (!withPaper) throw new Error("The catalog has papers that cost more");
    const product = await workshop.query(api.workshop.products.product, {
      handle: withPaper.handle,
    });
    expect(product).toMatchObject({
      handle: withPaper.handle,
      title: withPaper.title,
      published: true,
      forEvent: false,
      options: withPaper.options.map((option) => ({
        name: option.name,
        values: option.values.map((value) => ({
          name: value.name,
          surcharge: Math.round(value.surcharge * 100),
        })),
      })),
      page: `https://www.orvibo.it/products/${withPaper.handle}`,
      editedAt: null,
      editedBy: null,
    });
    expect(product?.images).toHaveLength(withPaper.images.length);
    expect(
      await workshop.query(api.workshop.products.product, {
        handle: "nowhere",
      }),
    ).toBeNull();
  });

  test("saves the team's changes, which the shop sells and the seed keeps", async () => {
    const { t, workshop } = await setUp();
    if (!withPaper) throw new Error("The catalog has papers that cost more");
    const papers = withPaper.options.map((option) =>
      option.values.map((_, place) => 100 * place),
    );
    await workshop.mutation(api.workshop.products.save, {
      ...luna,
      title: "  Luna, de la Jolene ",
      price: 900,
      compareAtPrice: 1000,
      minQuantity: 30,
    });
    await workshop.mutation(api.workshop.products.save, {
      handle: withPaper.handle,
      editedAt: null,
      title: withPaper.title,
      price: Math.round(withPaper.price * 100),
      compareAtPrice: null,
      minQuantity: withPaper.minQuantity ?? null,
      surcharges: papers,
      published: true,
    });

    expect(await t.query(api.shop.product, { handle: LUNA })).toMatchObject({
      title: "Luna, de la Jolene",
      price: 900,
      compareAtPrice: 1000,
      minQuantity: 30,
    });
    const saved = await workshop.query(api.workshop.products.product, {
      handle: LUNA,
    });
    expect(saved?.editedBy).toBe("atelier@jolene.ro");
    expect(saved?.editedAt).toBeNumber();
    const shelves = await t.run(async (ctx) => {
      const product = await ctx.db
        .query("products")
        .withIndex("by_handle", (q) => q.eq("handle", LUNA))
        .unique();
      if (!product) return [];
      return await ctx.db
        .query("productCategories")
        .withIndex("by_productId", (q) => q.eq("productId", product._id))
        .collect();
    });
    expect(shelves.map((shelf) => shelf.price)).toEqual([900, 900]);
    expect(
      (await t.query(api.shop.product, { handle: withPaper.handle }))?.options,
    ).toEqual(
      withPaper.options.map((option) => ({
        name: option.name,
        values: option.values.map((value, place) => ({
          name: value.name,
          surcharge: 100 * place,
        })),
      })),
    );

    await t.action(internal.init.seed, {});
    expect(await t.query(api.shop.product, { handle: LUNA })).toMatchObject({
      title: "Luna, de la Jolene",
      price: 900,
    });

    // The price before a discount and the minimum can go again.
    await workshop.mutation(api.workshop.products.save, {
      ...luna,
      editedAt: saved?.editedAt ?? null,
      title: "Luna, de la Jolene",
      price: 900,
      minQuantity: null,
    });
    const product = await t.query(api.shop.product, { handle: LUNA });
    expect(product?.compareAtPrice).toBeUndefined();
    expect(product?.minQuantity).toBeUndefined();
  });

  test("takes one off sale, and puts it back", async () => {
    const { t, workshop } = await setUp();
    await workshop.mutation(api.workshop.products.save, {
      ...luna,
      published: false,
    });
    expect(await t.query(api.shop.product, { handle: LUNA })).toBeNull();
    const shelf = await t.query(api.shop.products, {
      category: "invitatii-botez",
      paginationOpts: firstPage,
    });
    expect(shelf.page.map((product) => product.handle)).not.toContain(LUNA);
    const offSale = await workshop.query(api.workshop.products.list, {
      published: false,
      paginationOpts: firstPage,
    });
    expect(offSale.page.map((product) => product.handle)).toContain(LUNA);

    // The seed doesn't put it back on sale.
    await t.action(internal.init.seed, {});
    expect(await t.query(api.shop.product, { handle: LUNA })).toBeNull();

    const editedAt =
      (await workshop.query(api.workshop.products.product, { handle: LUNA }))
        ?.editedAt ?? null;
    await workshop.mutation(api.workshop.products.save, { ...luna, editedAt });
    expect(await t.query(api.shop.product, { handle: LUNA })).not.toBeNull();
  });

  test("changes nothing from a page someone else's change made old", async () => {
    const { workshop } = await setUp();
    await workshop.mutation(api.workshop.products.save, {
      ...luna,
      price: 900,
    });
    await expect(
      workshop.mutation(api.workshop.products.save, { ...luna, price: 950 }),
    ).rejects.toThrow("product-changed");
    expect(
      (await workshop.query(api.workshop.products.product, { handle: LUNA }))
        ?.price,
    ).toBe(900);
  });

  test("leaves a product the seed's when saving it as it is", async () => {
    const { workshop } = await setUp();
    await workshop.mutation(api.workshop.products.save, luna);
    expect(
      (await workshop.query(api.workshop.products.product, { handle: LUNA }))
        ?.editedAt,
    ).toBeNull();
  });

  test("refuses what a product can't have", async () => {
    const { workshop } = await setUp();
    for (const change of [
      { title: " " },
      { title: "L".repeat(201) },
      { price: 0 },
      { price: 850.5 },
      { compareAtPrice: 850 },
      { minQuantity: 0 },
      { minQuantity: 2.5 },
      { surcharges: [[0]] },
    ])
      await expect(
        workshop.mutation(api.workshop.products.save, { ...luna, ...change }),
      ).rejects.toThrow("invalid-input");
    if (!withPaper) throw new Error("The catalog has papers that cost more");
    await expect(
      workshop.mutation(api.workshop.products.save, {
        ...luna,
        handle: withPaper.handle,
        surcharges: withPaper.options.map((option) =>
          option.values.map(() => -100),
        ),
      }),
    ).rejects.toThrow("invalid-input");
    await expect(
      workshop.mutation(api.workshop.products.save, {
        ...luna,
        handle: "nowhere",
      }),
    ).rejects.toThrow("not-found");
  });

  test("open to the workshop alone", async () => {
    const { couple } = await setUp();
    await expect(
      couple.query(api.workshop.products.list, {
        published: true,
        paginationOpts: firstPage,
      }),
    ).rejects.toThrow("workshop-only");
    await expect(
      couple.query(api.workshop.products.product, { handle: LUNA }),
    ).rejects.toThrow("workshop-only");
    await expect(
      couple.query(api.workshop.products.categories, {}),
    ).rejects.toThrow("workshop-only");
    await expect(
      couple.mutation(api.workshop.products.save, luna),
    ).rejects.toThrow("workshop-only");
  });
});
