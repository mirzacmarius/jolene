import { describe, expect, test } from "bun:test";
import { fees } from "./catalog";
import { readCatalog } from "./files";

const catalog = await readCatalog();
const lineOptions = new Map(catalog.lineOptions.map((o) => [o.handle, o]));
const categories = new Set(catalog.categories.map((c) => c.handle));

/** Lei with at most two decimals, as Shopify's prices are. */
const lei = (amount: number) =>
  Number.isFinite(amount) &&
  Math.abs(amount * 100 - Math.round(amount * 100)) < 1e-9;

const handle = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

test("handles are unique and Shopify's", () => {
  for (const list of [
    catalog.products,
    catalog.lineOptions,
    catalog.categories,
  ]) {
    const handles = list.map((item) => item.handle);
    expect(new Set(handles).size).toBe(handles.length);
    for (const h of handles) expect(h).toMatch(handle);
  }
});

describe("products", () => {
  test("ask options and sit in categories that exist", () => {
    for (const product of catalog.products) {
      for (const h of product.lineOptions)
        expect(lineOptions.has(h)).toBe(true);
      for (const h of product.categories) expect(categories.has(h)).toBe(true);
      for (const fee of product.fees) expect(fees).toHaveProperty(fee);
    }
  });

  test("fit Shopify's options: three, 2048 variants, distinct values", () => {
    for (const product of catalog.products) {
      expect(product.options.length).toBeLessThanOrEqual(3);
      const variants = product.options.reduce(
        (count, option) => count * option.values.length,
        1,
      );
      expect(variants).toBeLessThanOrEqual(2048);
      for (const option of product.options) {
        const names = option.values.map((value) => value.name);
        expect(new Set(names).size).toBe(names.length);
        for (const value of option.values)
          expect(lei(value.surcharge)).toBe(true);
      }
    }
  });

  test("cost lei, and less than before when on sale", () => {
    for (const product of catalog.products) {
      expect(product.price).toBeGreaterThan(0);
      expect(lei(product.price)).toBe(true);
      if (product.compareAtPrice !== undefined)
        expect(product.compareAtPrice).toBeGreaterThan(product.price);
    }
  });

  test("keep their old address and have photos", () => {
    const paths = catalog.products.map((product) => product.woo.path);
    expect(new Set(paths).size).toBe(paths.length);
    for (const product of catalog.products) {
      expect(product.woo.path).toStartWith("/produs/");
      expect(product.images.length).toBeGreaterThan(0);
      for (const image of product.images)
        expect(image.url).toStartWith("https://jolene.ro/wp-content/uploads/");
    }
  });

  test("describe themselves with formatting only", () => {
    for (const { descriptionHtml } of catalog.products) {
      expect(descriptionHtml).not.toMatch(/<(?!br \/>|hr \/>)[a-z0-9]+\s/);
      expect(descriptionHtml).not.toMatch(
        /<\/?(?:span|div|a|img|script|style)\b/,
      );
    }
  });
});

test("line options are asked and well formed", () => {
  const asked = new Set(catalog.products.flatMap((p) => p.lineOptions));
  for (const option of catalog.lineOptions) {
    expect(asked.has(option.handle)).toBe(true);
    expect(
      option.handle === option.key ||
        option.handle.startsWith(`${option.key}-`),
    ).toBe(true);
    expect(option.choices.length > 0).toBe(option.kind === "select");
    for (const choice of option.choices) expect(lei(choice.price)).toBe(true);
  }
});
