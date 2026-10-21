import type { SortValue } from "@/lib/categories/types";
import type { ProductCard } from "@/lib/product/types";

export interface SearchResults {
  products: ProductCard[];
  query: string;
  sort: SortValue;
}
