import { describe, expect, test } from "bun:test";
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
