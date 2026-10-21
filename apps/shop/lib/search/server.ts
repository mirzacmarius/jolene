import { api } from "@jolene/backend/convex/_generated/api";
import { fetchQuery } from "convex/nextjs";
import { cacheLife, cacheTag } from "next/cache";

import type { SortValue } from "@/lib/categories/types";
import { toProductCard } from "@/lib/product";
import type { ProductCard } from "@/lib/product/types";
import { sortSearchResults } from "@/lib/search";
import type { SearchResults } from "@/lib/search/types";

export const SEARCH_LIMIT = 100;

export async function searchProducts(query: string, limit: number): Promise<ProductCard[]> {
  "use cache: remote";
  cacheLife("minutes");
  cacheTag("products", "products-index");

  const term = query.trim();
  if (!term) return [];
  return (await fetchQuery(api.shop.search, { limit, query: term })).map(toProductCard);
}

export async function getSearchResults({
  query,
  sort,
}: {
  query: string;
  sort: SortValue;
}): Promise<SearchResults> {
  return {
    products: sortSearchResults(await searchProducts(query, SEARCH_LIMIT), sort),
    query: query.trim(),
    sort,
  };
}
