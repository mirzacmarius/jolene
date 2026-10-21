import type { SortValue } from "@/lib/categories/types";
import type { ProductCard } from "@/lib/product/types";

/** The search page's address for a term. */
export function getSearchUrl(query: string): string {
  return `/search?${new URLSearchParams({ q: query })}`;
}

// Convex's search index ranks by relevance only, and a search returns at most a hundred products, so price orders sort here.
export function sortSearchResults(products: ProductCard[], sort: SortValue): ProductCard[] {
  if (sort === "manual") return products;
  const direction = sort === "price-ascending" ? 1 : -1;
  return products.toSorted((a, b) => direction * (a.price - b.price));
}
