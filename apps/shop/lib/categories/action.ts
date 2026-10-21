"use server";

import { parseSort } from "@/lib/categories";
import { fetchProductPage } from "@/lib/categories/server";
import type { BrowseSource } from "@/lib/categories/types";
import type { ProductPage } from "@/lib/product/types";

export async function loadMoreProductsAction({
  cursor,
  sort,
  source,
}: {
  cursor: string;
  sort: string;
  source: BrowseSource;
}): Promise<ProductPage> {
  return fetchProductPage({ cursor, sort: parseSort(sort), source });
}
