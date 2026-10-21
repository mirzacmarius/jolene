import { Suspense } from "react";

import { ProductsGridSkeleton } from "@/components/product/products-grid";
import { PRODUCTS_PER_PAGE } from "@/lib/categories";

import { SortSelect, SortSelectFallback } from "./sort-select";

export function BrowseToolbar() {
  return (
    <div className="flex items-center justify-end gap-5">
      <Suspense fallback={<SortSelectFallback />}>
        <SortSelect />
      </Suspense>
    </div>
  );
}

export function BrowseFallback() {
  return (
    <>
      <div className="flex items-center justify-end gap-5">
        <SortSelectFallback />
      </div>
      <ProductsGridSkeleton
        className="sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5"
        count={PRODUCTS_PER_PAGE}
      />
    </>
  );
}
