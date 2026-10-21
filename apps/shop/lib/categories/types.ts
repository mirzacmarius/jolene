import type { SORT_VALUES } from "@/lib/categories";
import type { Image } from "@/lib/media/types";
import type { ProductPage } from "@/lib/product/types";

/** Which products a list shows: a category's, or every product on sale. */
export type BrowseSource = { category: string; type: "category" } | { type: "all" };

export interface BrowseResults extends ProductPage {
  sort: SortValue;
  source: BrowseSource;
}

/** A shelf of the shop; its address still says /collections/, as the template had it. */
export interface Category {
  handle: string;
  path: string;
  title: string;
}

export interface CategoryWithThumbnail extends Category {
  thumbnail: Image | null;
}

export type SortValue = (typeof SORT_VALUES)[number];
