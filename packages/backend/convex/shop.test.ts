import { describe, expect, test } from "bun:test";
import { catalog } from "@jolene/products/data";
import { Glob } from "bun";
import type { FunctionReturnType } from "convex/server";
import { convexTest } from "convex-test";
import { api, internal } from "./_generated/api";
import type { MutationCtx } from "./_generated/server";
import schema from "./schema";
import { shelve } from "./shop/load";

// convex-test loads the functions from this map, as Vite's import.meta.glob
// would build it.
const modules = Object.fromEntries(
  [...new Glob("**/*.ts").scanSync(import.meta.dir)]
    .filter((path) => !path.endsWith(".test.ts"))
    .map((path) => [`./${path}`, () => import(`./${path}`)]),
);

const firstPage = { numItems: 1000, cursor: null };

async function seeded() {
  const t = convexTest(schema, modules);
  await t.action(internal.init.seed, {});
  return t;
}

const productByHandle = (ctx: MutationCtx, handle: string) =>
  ctx.db
    .query("products")
    .withIndex("by_handle", (q) => q.eq("handle", handle))
    .unique();

describe("shop.product", () => {
  test("shows a product as jolene.ro sold it, its prices in bani", async () => {
    const t = await seeded();
    const luna = await t.query(api.shop.product, { handle: "18207" });
    expect(luna).toMatchObject({
      title: "Invitație botez Luna",
      price: 850,
      minQuantity: 20,
      fees: [
        {
          key: "diacritice-50",
          label: "Diacritice",
          description: "Textul tipărit cu diacritice, o dată pe comandă.",
          price: 5000,
        },
      ],
      categories: [
        { handle: "invitatii-botez", title: "Invitații botez" },
        { handle: "invitatii-botez-baieti", title: "Invitații băieți" },
      ],
      images: [
        {
          url: "https://jolene.ro/wp-content/uploads/2021/10/Jolene_Fotograf_Irina_Mocanu_53.jpg",
          alt: "Invitatie botez baiat",
        },
        {
          url: "https://jolene.ro/wp-content/uploads/2021/10/Jolene_Fotograf_Irina_Mocanu_56.jpg",
          alt: "Invitație botez Luna",
        },
      ],
    });
    expect(luna?.lineOptions.map((option) => option.handle)).toEqual([
      "text-personalizat-2",
    ]);
  });

  test("prices papers and paid choices in bani", async () => {
    const t = await seeded();
    const withPaper = catalog.products.find(
      (product) => product.options.length > 0,
    );
    const withChoices = catalog.lineOptions.find((option) =>
      option.choices.some((choice) => choice.price % 1 !== 0),
    );
    if (!withPaper || !withChoices)
      throw new Error("The catalog has papers and choices priced in bani");

    const product = await t.query(api.shop.product, {
      handle: withPaper.handle,
    });
    expect(product?.options).toEqual(
      withPaper.options.map((option) => ({
        name: option.name,
        values: option.values.map((value) => ({
          name: value.name,
          surcharge: Math.round(value.surcharge * 100),
        })),
      })),
    );
    const stored = await t.run((ctx) =>
      ctx.db
        .query("lineOptions")
        .withIndex("by_handle", (q) => q.eq("handle", withChoices.handle))
        .unique(),
    );
    expect(stored?.choices).toEqual(
      withChoices.choices.map((choice) => ({
        label: choice.label,
        price: Math.round(choice.price * 100),
      })),
    );
  });

  test("shows nothing for a product off sale or unknown", async () => {
    const t = await seeded();
    await t.run(async (ctx) => {
      const luna = await productByHandle(ctx, "18207");
      if (luna) await ctx.db.patch("products", luna._id, { published: false });
    });
    expect(await t.query(api.shop.product, { handle: "18207" })).toBeNull();
    expect(await t.query(api.shop.product, { handle: "nowhere" })).toBeNull();
  });
});

describe("init.seed", () => {
  test("loads the whole catalog, and seeding again changes nothing", async () => {
    const t = await seeded();
    const count = () =>
      t.run(async (ctx) => ({
        products: (await ctx.db.query("products").take(10_000)).length,
        shelves: (await ctx.db.query("productCategories").take(10_000)).length,
        categories: (await ctx.db.query("categories").take(1000)).length,
        lineOptions: (await ctx.db.query("lineOptions").take(1000)).length,
        fees: (await ctx.db.query("fees").take(100)).length,
      }));
    const before = await count();
    expect(before).toEqual({
      products: catalog.products.length,
      shelves: catalog.products.reduce(
        (sum, product) => sum + new Set(product.categories).size,
        0,
      ),
      categories: catalog.categories.length,
      lineOptions: catalog.lineOptions.length,
      fees: 3,
    });
    await t.action(internal.init.seed, {});
    expect(await count()).toEqual(before);
  });

  test("leaves a product Jolene's team changed as they made it", async () => {
    const t = await seeded();
    await t.run(async (ctx) => {
      const luna = await productByHandle(ctx, "18207");
      if (luna)
        await ctx.db.patch("products", luna._id, {
          title: "Luna, de la Jolene",
          editedAt: Date.now(),
        });
    });
    await t.action(internal.init.seed, {});
    expect(await t.query(api.shop.product, { handle: "18207" })).toMatchObject({
      title: "Luna, de la Jolene",
    });
  });

  test("takes off sale a product the catalog no longer lists", async () => {
    const t = await seeded();
    await t.run(async (ctx) => {
      const luna = await productByHandle(ctx, "18207");
      if (!luna) throw new Error("Luna is in the catalog");
      const { _id, _creationTime, ...fields } = luna;
      const gone = { ...fields, handle: "gone" };
      await shelve(ctx, await ctx.db.insert("products", gone), gone);
    });
    await t.action(internal.init.seed, {});
    expect(await t.query(api.shop.product, { handle: "gone" })).toBeNull();
    const shelf = await t.query(api.shop.products, {
      category: "invitatii-botez",
      paginationOpts: firstPage,
    });
    expect(shelf.page.map((product) => product.handle)).not.toContain("gone");
  });

  test("keeps a photo's stored copy while its address stays", async () => {
    const t = await seeded();
    const storageId = await t.run(async (ctx) => {
      const luna = await productByHandle(ctx, "18207");
      if (!luna) throw new Error("Luna is in the catalog");
      const storageId = await ctx.storage.store(new Blob(["luna"]));
      await ctx.db.patch("products", luna._id, {
        images: luna.images.map((image, index) =>
          index === 0 ? { ...image, storageId } : image,
        ),
      });
      return storageId;
    });
    await t.action(internal.init.seed, {});
    const luna = await t.query(api.shop.product, { handle: "18207" });
    expect(luna?.images[0]?.url).not.toStartWith("https://jolene.ro/");
    expect(luna?.images[1]?.url).toStartWith("https://jolene.ro/");

    const { _id, _creationTime, published, images, ...fields } = await t.run(
      async (ctx) => {
        const luna = await productByHandle(ctx, "18207");
        if (!luna) throw new Error("Luna is in the catalog");
        return luna;
      },
    );
    await t.mutation(internal.shop.load.products, {
      products: [
        {
          ...fields,
          images: [{ source: "https://jolene.ro/new.jpg", alt: "Luna" }],
        },
      ],
    });
    expect(await t.run((ctx) => ctx.storage.getUrl(storageId))).toBeNull();
  });
});

describe("shop.products", () => {
  test("lists a category in Jolene's order, or by price", async () => {
    const t = await seeded();
    const inCategory = catalog.products
      .map((product, position) => ({ ...product, position }))
      .filter((product) => product.categories.includes("invitatii-botez"));

    const ordered = await t.query(api.shop.products, {
      category: "invitatii-botez",
      paginationOpts: firstPage,
    });
    expect(ordered.page.map((product) => product.handle)).toEqual(
      inCategory.map((product) => product.handle),
    );

    const cheapestFirst = await t.query(api.shop.products, {
      category: "invitatii-botez",
      sort: "price-ascending",
      paginationOpts: firstPage,
    });
    const prices = cheapestFirst.page.map((product) => product.price);
    expect(prices).toEqual([...prices].sort((a, b) => a - b));
    expect(prices).toHaveLength(inCategory.length);
  });

  test("lists every product on sale a page at a time", async () => {
    const t = await seeded();
    const handles: string[] = [];
    let cursor: string | null = null;
    for (;;) {
      const result: FunctionReturnType<typeof api.shop.products> =
        await t.query(api.shop.products, {
          sort: "price-descending",
          paginationOpts: { numItems: 200, cursor },
        });
      handles.push(...result.page.map((product) => product.handle));
      if (result.isDone) break;
      cursor = result.continueCursor;
    }
    expect(handles.sort()).toEqual(
      catalog.products.map((product) => product.handle).sort(),
    );
  });
});

describe("shop.search", () => {
  test("finds products by name", async () => {
    const t = await seeded();
    const found = await t.query(api.shop.search, { query: "Luna" });
    expect(found.map((product) => product.handle)).toContain("18207");
  });
});

describe("shop.categories", () => {
  test("lists the categories in the menu's order, and finds one", async () => {
    const t = await seeded();
    expect(await t.query(api.shop.categories, {})).toEqual(catalog.categories);
    expect(
      await t.query(api.shop.category, { handle: "invitatii-botez" }),
    ).toEqual({ handle: "invitatii-botez", title: "Invitații botez" });
    expect(await t.query(api.shop.category, { handle: "nowhere" })).toBeNull();
  });
});
