import { api } from "@jolene/backend/convex/_generated/api";
import { fetchQuery } from "convex/nextjs";
import type { Metadata } from "next";
import { cacheLife, cacheTag } from "next/cache";

import {
  ALL_PRODUCTS_HANDLE,
  describeCategory,
  PRODUCTS_PER_PAGE,
  toConvexSort,
} from "@/lib/categories";
import type {
  BrowseResults,
  BrowseSource,
  Category,
  CategoryWithThumbnail,
  SortValue,
} from "@/lib/categories/types";
import { toImage, toProductCard } from "@/lib/product";
import type { ProductPage } from "@/lib/product/types";
import { buildAlternates, buildOpenGraph } from "@/lib/seo";

function toCategory({ handle, title }: { handle: string; title: string }): Category {
  return { handle, path: `/collections/${handle}`, title };
}

export async function getCategories(): Promise<CategoryWithThumbnail[]> {
  "use cache: remote";
  cacheLife("minutes");
  cacheTag("categories");

  const categories = await fetchQuery(api.shop.categories, {});
  return categories.map((category) => ({
    ...toCategory(category),
    thumbnail: category.image ? toImage(category.image) : null,
  }));
}

export async function getCategory(handle: string): Promise<Category | undefined> {
  "use cache: remote";
  cacheLife("minutes");
  cacheTag("categories", `category-${handle}`);

  if (handle === ALL_PRODUCTS_HANDLE) return getAllProductsCategory();
  const category = await fetchQuery(api.shop.category, { handle });
  return category ? toCategory(category) : undefined;
}

export function getAllProductsCategory(): Category {
  return toCategory({ handle: ALL_PRODUCTS_HANDLE, title: "Toate produsele" });
}

/** A page of a list's products; a cursor from the page before continues it. */
export async function fetchProductPage({
  cursor,
  sort,
  source,
}: {
  cursor: string | null;
  sort: SortValue;
  source: BrowseSource;
}): Promise<ProductPage> {
  const result = await fetchQuery(api.shop.products, {
    category: source.type === "category" ? source.category : undefined,
    paginationOpts: { cursor, numItems: PRODUCTS_PER_PAGE },
    sort: toConvexSort(sort),
  });
  return {
    cursor: result.isDone ? null : result.continueCursor,
    products: result.page.map(toProductCard),
  };
}

// Each list has three orders, so every first page is worth caching; Load more pages stay live so their cursors meet the catalog as it is.
export async function getBrowseResults(params: {
  sort: SortValue;
  source: BrowseSource;
}): Promise<BrowseResults> {
  "use cache: remote";
  cacheLife("minutes");
  cacheTag(
    "products",
    params.source.type === "category" ? `category-${params.source.category}` : "products-index",
  );

  return { ...(await fetchProductPage({ ...params, cursor: null })), ...params };
}

export async function getCategoryMetadata(handle: string): Promise<Metadata> {
  const category = await getCategory(handle);
  const title = category?.title ?? "Categorie";
  const description = category ? describeCategory(category) : "";
  const url = `/collections/${handle}`;
  return {
    alternates: buildAlternates({ pathname: url }),
    description,
    openGraph: buildOpenGraph({ description, title, type: "website", url }),
    title,
    twitter: {
      card: "summary_large_image",
      description,
      images: ["/og-default.png"],
      title,
    },
  };
}
