"use server";

import type { ProductCard } from "@/lib/product/types";
import { searchProducts } from "@/lib/search/server";

const SUGGESTION_LIMIT = 4;

export async function suggestProductsAction(query: string): Promise<ProductCard[]> {
  return searchProducts(String(query).slice(0, 100), SUGGESTION_LIMIT);
}
