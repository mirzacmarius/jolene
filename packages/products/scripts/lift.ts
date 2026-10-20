/**
 * Lifts jolene.ro's catalog from its WooCommerce shop into catalog/:
 *
 *   bun scripts/lift.ts [folder]
 *
 * The folder holds the shop's products.json, categories.json and
 * image-labels.json, by default the project's copy from 19 October 2026.
 */
import { join } from "node:path";
import type { Product } from "../src/catalog";
import { writeCatalog } from "../src/files";
import { liftCatalog } from "../src/lift/lift";

const from = process.argv[2] ?? "/mnt/project-files/jolene-catalog";
const read = (name: string) => Bun.file(join(from, name)).json();
const catalog = liftCatalog({
  products: await read("products.json"),
  categories: await read("categories.json"),
  labels: await read("image-labels.json"),
});
await writeCatalog(catalog);

const count = (test: (product: Product) => boolean) =>
  catalog.products.filter(test).length;
console.log(
  [
    `${catalog.products.length} products in ${catalog.categories.length} categories`,
    `${catalog.lineOptions.length} line options`,
    `${count((product) => product.options.length > 0)} with variants`,
    `${count((product) => product.minQuantity !== undefined)} with a minimum`,
    `${count((product) => product.fees.length > 0)} with a fee`,
    `${count((product) => product.compareAtPrice !== undefined)} on sale`,
  ].join("\n"),
);
