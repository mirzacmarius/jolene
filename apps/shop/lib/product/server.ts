import { api } from "@jolene/backend/convex/_generated/api";
import { fetchQuery } from "convex/nextjs";
import type { FunctionReturnType } from "convex/server";
import { cacheLife, cacheTag } from "next/cache";

import { toProductCard, toProductDetails } from "@/lib/product";
import type { ProductCard, ProductDetails } from "@/lib/product/types";

// The workshop's refresh (app/api/catalog/refresh) can fail and the seed sends none, so "minutes" bounds how stale a page gets.
export async function getProduct(handle: string): Promise<ProductDetails | undefined> {
  "use cache: remote";
  cacheLife("minutes");
  cacheTag("products", `product-${handle}`);

  const product = await fetchQuery(api.shop.product, { handle });
  return product ? toProductDetails(product) : undefined;
}

/** Other products of a category, in Jolene's order. */
export async function getRelatedProducts(params: {
  category: string;
  handle: string;
  limit: number;
}): Promise<ProductCard[]> {
  "use cache: remote";
  cacheLife("minutes");
  cacheTag("products", `category-${params.category}`);

  const { page } = await fetchQuery(api.shop.products, {
    category: params.category,
    paginationOpts: { cursor: null, numItems: params.limit + 1 },
  });
  return page
    .filter((product) => product.handle !== params.handle)
    .slice(0, params.limit)
    .map(toProductCard);
}

const HANDLES_PER_PAGE = 200;

/** Every product on sale, in Jolene's order, for the sitemap. */
export async function getProductHandles(): Promise<string[]> {
  "use cache: remote";
  cacheLife("hours");
  cacheTag("products", "products-index");

  const handles: string[] = [];
  let result: FunctionReturnType<typeof api.shop.products> | undefined;
  do {
    result = await fetchQuery(api.shop.products, {
      paginationOpts: { cursor: result?.continueCursor ?? null, numItems: HANDLES_PER_PAGE },
    });
    handles.push(...result.page.map((product) => product.handle));
  } while (!result.isDone);
  return handles;
}
