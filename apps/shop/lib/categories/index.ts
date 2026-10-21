import type { BrowseSource, Category, SortValue } from "@/lib/categories/types";
import { shopConfig } from "@/lib/config";

export const ALL_PRODUCTS_HANDLE = "all";

export const PRODUCTS_PER_PAGE = 40;

// The `sort_by` values jolene.ro's lists and the template's links already use; "manual" is Jolene's own order.
export const SORT_VALUES = ["manual", "price-ascending", "price-descending"] as const;

export function parseSort(value: string | null | undefined): SortValue {
  return SORT_VALUES.find((sort) => sort === value) ?? "manual";
}

/** The order Convex lists products in for a sort. */
export function toConvexSort(sort: SortValue) {
  return sort === "manual" ? ("position" as const) : sort;
}

export function getBrowseSource(handle: string): BrowseSource {
  return handle === ALL_PRODUCTS_HANDLE ? { type: "all" } : { category: handle, type: "category" };
}

const CATEGORY_PATH = /^\/collections\/([^/]+)\/?$/;
const REFINED_CATEGORY_PATH = /^\/collections\/[^/]+\/refine\/?$/;

// The default view never reads search params so its products stay in the static shell and prefetches; sorted views render from the request-time `refine` route.
export function getRefinedCategoryPath(pathname: string, search: string): string | null {
  const handle = CATEGORY_PATH.exec(pathname)?.[1];
  return handle && parseSort(new URLSearchParams(search).get("sort_by")) !== "manual"
    ? `/collections/${handle}/refine`
    : null;
}

export function isRefinedCategoryPath(pathname: string): boolean {
  return REFINED_CATEGORY_PATH.test(pathname);
}

export function describeCategory(category: Category): string {
  return category.handle === ALL_PRODUCTS_HANDLE
    ? `Toate invitațiile, mărturiile și accesoriile ${shopConfig.site.name}, personalizate în studio și tipărite în atelierul nostru.`
    : `${category.title} de la ${shopConfig.site.name}, personalizate în studio și tipărite în atelierul nostru.`;
}
