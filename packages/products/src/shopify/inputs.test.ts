import { describe, expect, test } from "bun:test";
import type { Product } from "../catalog";
import { readCatalog } from "../files";
import {
  choiceUpserts,
  extras,
  extrasInput,
  extrasValue,
  feeHandles,
  feeProductInput,
  type Ids,
  money,
  mostExtras,
  productInput,
} from "./inputs";

const catalog = await readCatalog();

const ids: Ids = {
  definition: (type) => `definition/${type}`,
  metaobject: (type, handle) => `${type}/${handle}`,
  collection: (handle) => `collection/${handle}`,
  feeVariant: (fee) => `fee/${fee}`,
};

const product: Product = {
  handle: "meniu",
  title: "Meniu",
  descriptionHtml: "<p>Meniu</p>",
  price: 7,
  compareAtPrice: 8,
  options: [],
  lineOptions: ["culoare-plic"],
  categories: ["meniuri-nunta"],
  tags: [],
  images: [{ url: "https://jolene.ro/a.jpg", alt: "Meniu" }],
  minQuantity: 30,
  fees: ["diacritice-50"],
  woo: { id: 1, path: "/produs/meniu/" },
};

describe("productInput", () => {
  test("gives a product without options Shopify's default variant", () => {
    const input = productInput(product, ids, { status: "DRAFT" });
    expect(input.productOptions).toEqual([
      { name: "Title", values: [{ name: "Default Title" }] },
    ]);
    expect(input.variants).toEqual([
      {
        optionValues: [{ optionName: "Title", name: "Default Title" }],
        price: "7.00",
        compareAtPrice: "8.00",
        inventoryItem: { tracked: false },
      },
    ]);
    expect(input.metafields).toEqual([
      {
        namespace: "jolene",
        key: "line_options",
        type: "list.metaobject_reference",
        value: '["jolene_line_option/culoare-plic"]',
      },
      {
        namespace: "jolene",
        key: "min_quantity",
        type: "number_integer",
        value: "30",
      },
      {
        namespace: "jolene",
        key: "fees",
        type: "list.variant_reference",
        value: '["fee/diacritice-50"]',
      },
    ]);
    expect(input).toMatchObject({
      status: "DRAFT",
      collections: ["collection/meniuri-nunta"],
      files: [
        {
          originalSource: "https://jolene.ro/a.jpg",
          alt: "Meniu",
          contentType: "IMAGE",
        },
      ],
    });
  });

  test("prices a variant for each combination of the options' values", () => {
    const input = productInput(
      {
        ...product,
        compareAtPrice: undefined,
        options: [
          {
            name: "Carton",
            values: [
              { name: "Mat", surcharge: 0 },
              { name: "Sidef", surcharge: 1.5 },
            ],
          },
          {
            name: "Culoare",
            values: [
              { name: "Alb", surcharge: 0 },
              { name: "Roz", surcharge: 0.2 },
            ],
          },
        ],
      },
      ids,
    );
    expect(
      input.variants.map((v) => [
        v.optionValues.map((o) => o.name).join(" / "),
        v.price,
      ]),
    ).toEqual([
      ["Mat / Alb", "7.00"],
      ["Mat / Roz", "7.20"],
      ["Sidef / Alb", "8.50"],
      ["Sidef / Roz", "8.70"],
    ]);
    // An update leaves the status and photos as the store has them.
    expect(input).not.toHaveProperty("status");
    expect(input).not.toHaveProperty("files");
  });
});

test("choice handles are unique handles", () => {
  for (const { handle } of choiceUpserts(catalog))
    expect(handle.handle).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
});

test("the extras product charges whatever a product's options add up to", () => {
  const input = extrasInput();
  const prices = input.variants.map((variant) => variant.price);
  expect(prices[0]).toBe("0.10");
  expect(prices.at(-1)).toBe("20.00");
  expect(new Set(prices).size).toBe(200);
  expect(input.productOptions[0]?.values[44]).toEqual({ name: "4,50 lei" });
  expect(extrasValue(10.7)).toBe("10,70 lei");
  for (const p of catalog.products)
    expect(mostExtras(p, catalog)).toBeLessThanOrEqual(extras.most);
});

test("fee products have a variant for each fee", () => {
  expect(
    feeHandles.map((handle) =>
      feeProductInput(handle).variants.map((v) => [
        v.optionValues[0]?.name,
        v.price,
      ]),
    ),
  ).toEqual([
    [
      ["50 lei", "50.00"],
      ["10 lei", "10.00"],
    ],
    [["200 lei", "200.00"]],
  ]);
});

test("money is lei with two decimals", () => {
  expect(money(1.3 + 0.1)).toBe("1.40");
  expect(money(7)).toBe("7.00");
});
