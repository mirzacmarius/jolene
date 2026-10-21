import categories from "../catalog/categories.json";
import lineOptions from "../catalog/line-options.json";
import products from "../catalog/products.json";
import type { Catalog } from "./catalog";

/**
 * The catalog as the lift last wrote it, for code that can't read files,
 * such as the Convex seed. Whoever stores it checks its shape.
 */
export const catalog = {
  products,
  lineOptions,
  categories,
} as unknown as Catalog;
