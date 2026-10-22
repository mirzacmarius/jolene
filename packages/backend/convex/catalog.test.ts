import { describe, expect, test } from "bun:test";
import { catalog } from "@jolene/products/data";
import { photoUrl } from "@jolene/products/photos";
import { suites } from "@jolene/suites";
import { Glob } from "bun";
import { convexTest } from "convex-test";
import { api, internal } from "./_generated/api";
import schema from "./schema";

// convex-test loads the functions from this map, as Vite's import.meta.glob
// would build it.
const modules = Object.fromEntries(
  [...new Glob("**/*.ts").scanSync(import.meta.dir)]
    .filter((path) => !path.endsWith(".test.ts"))
    .map((path) => [`./${path}`, () => import(`./${path}`)]),
);

describe("catalog.artwork", () => {
  test("lists a suite's artwork, each file once, with its link", async () => {
    const t = convexTest(schema, modules);
    await t.action(internal.init.seed, {});
    const boho = suites.find((suite) => suite.slug === "boho");
    if (!boho) throw new Error("Boho is one of Jolene's collections");

    const artwork = await t.query(api.catalog.artwork, { slug: "boho" });
    expect(artwork.map((art) => art.key).sort()).toEqual(
      Object.keys(boho.art).sort(),
    );
    for (const art of artwork) {
      expect(art.url).toBe(boho.art[art.key]?.path as string);
      expect(art.name).toBe(boho.art[art.key]?.name as string);
      expect(art.recolorable).toBe(boho.art[art.key]?.recolorable ?? false);
    }
  });

  test("lists nothing for a suite that isn't published", async () => {
    const t = convexTest(schema, modules);
    await t.action(internal.init.seed, {});
    await t.run(async (ctx) => {
      const forest = await ctx.db
        .query("suites")
        .withIndex("by_slug", (q) => q.eq("slug", "forest"))
        .unique();
      if (forest)
        await ctx.db.patch("suites", forest._id, { published: false });
    });
    expect(await t.query(api.catalog.artwork, { slug: "forest" })).toEqual([]);
    expect(await t.query(api.catalog.artwork, { slug: "nowhere" })).toEqual([]);
  });
});

describe("catalog.suites and catalog.suite", () => {
  const listed = (handle: string) => {
    const product = catalog.products.find((p) => p.handle === handle);
    if (!product) throw new Error(`${handle} is one of Jolene's products`);
    return product;
  };

  test("give each item its product: the least it costs, its minimum order and its photos", async () => {
    const t = convexTest(schema, modules);
    await t.action(internal.init.seed, {});
    const invitation = listed("invitatie-nunta-royal-blue");
    const [first] = invitation.images;
    if (!first) throw new Error("Royal Blue's invitation has photos");

    const { suites: shown } = await t.query(api.catalog.suites, {});
    const royalBlue = shown.find((suite) => suite.slug === "royal-blue");
    // The gallery shows the invitation's first photo; its papers and order
    // options can only add to its 6 lei.
    expect(royalBlue?.lead?.product).toEqual({
      handle: "invitatie-nunta-royal-blue",
      price: 600,
      varies: true,
      minQuantity: 30,
      photos: [{ url: photoUrl(first.url), alt: first.alt }],
    });

    const suite = await t.query(api.catalog.suite, { slug: "royal-blue" });
    expect(
      suite?.templates.map((template) => template.product?.handle),
    ).toEqual([
      "invitatie-nunta-royal-blue",
      "save-the-date-royal",
      "meniu-nunta-royal-blue",
      "plic-de-bani-royal-blue",
    ]);
    expect(suite?.templates[0]?.product?.photos).toEqual(
      invitation.images.map((image) => ({
        url: photoUrl(image.url),
        alt: image.alt,
      })),
    );
    // Rounded corners cost 1 leu more; it has no minimum order.
    expect(suite?.templates[1]?.product).toMatchObject({
      price: 1000,
      varies: true,
    });
    expect(suite?.templates[1]?.product?.minQuantity).toBeUndefined();
    expect(suite?.delivery).toEqual({ courier: 2500, freeFrom: 80_000 });
  });

  test("count a required choice's cheapest price and leave out a product off sale", async () => {
    const t = convexTest(schema, modules);
    await t.action(internal.init.seed, {});
    await t.run(async (ctx) => {
      // Royal Blue's money envelope asks Personalizat, General or Nominal.
      const personalised = await ctx.db
        .query("lineOptions")
        .withIndex("by_handle", (q) => q.eq("handle", "personalizat"))
        .unique();
      if (!personalised) throw new Error("personalizat is an order option");
      await ctx.db.patch("lineOptions", personalised._id, {
        choices: [
          { label: "General", price: 50 },
          { label: "Nominal", price: 100 },
        ],
      });
      const invitation = await ctx.db
        .query("products")
        .withIndex("by_handle", (q) =>
          q.eq("handle", "invitatie-nunta-royal-blue"),
        )
        .unique();
      if (!invitation) throw new Error("Royal Blue's invitation is for sale");
      await ctx.db.patch("products", invitation._id, { published: false });
    });

    const suite = await t.query(api.catalog.suite, { slug: "royal-blue" });
    expect(suite?.templates[0]?.product).toBeNull();
    const envelope = listed("plic-de-bani-royal-blue");
    const papers = envelope.options.flatMap((option) =>
      option.values.map((value) => value.surcharge),
    );
    expect(suite?.templates[3]?.product?.price).toBe(
      Math.round((envelope.price + Math.min(...papers)) * 100) + 50,
    );
    const { suites: shown } = await t.query(api.catalog.suites, {});
    expect(
      shown.find((suite) => suite.slug === "royal-blue")?.lead?.product,
    ).toBeNull();
  });
});
