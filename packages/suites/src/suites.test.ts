import { describe, expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { assetKeys, documentSchema, suiteStyles } from "@jolene/design";
import { readCatalog } from "@jolene/products";
import { suites } from "./index";

const publicDir = join(import.meta.dir, "../../../apps/studio/public");

describe.each(suites.map((suite) => [suite.slug, suite] as const))(
  "%s",
  (_slug, suite) => {
    test.each(suite.templates.map((template) => [template.slug, template]))(
      "%s is a valid design for the suite's occasion",
      (_template, { document }) => {
        const parsed = documentSchema.parse(document);
        expect(parsed.occasion).toBe(suite.occasion);
        for (const key of assetKeys(parsed))
          expect(suite.art).toHaveProperty(key);
      },
    );

    test("draws only artwork the studio serves", () => {
      for (const artwork of Object.values(suite.art))
        expect(existsSync(join(publicDir, artwork.path))).toBe(true);
    });

    test("lists one template per item and known styles", () => {
      const kinds = suite.templates.map(
        (template) => documentSchema.parse(template.document).kind,
      );
      expect(new Set(kinds).size).toBe(kinds.length);
      for (const style of suite.styles)
        expect(suiteStyles).toHaveProperty(style);
    });
  },
);

test("suite and template slugs are unique", () => {
  const slugs = suites.flatMap((suite) => [
    suite.slug,
    ...suite.templates.map((template) => template.slug),
  ]);
  expect(new Set(slugs).size).toBe(slugs.length);
});

test("templates are sold as products of the catalog", async () => {
  const { products } = await readCatalog();
  const handles = new Set(products.map((product) => product.handle));
  for (const suite of suites)
    for (const template of suite.templates)
      if (template.shopifyProductHandle)
        expect(handles).toContain(template.shopifyProductHandle);
});
