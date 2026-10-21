import { ProductCard } from "@/components/product-card/product-card";
import { ProductsGridSkeleton } from "@/components/product/products-grid";
import { PRODUCTS_PER_PAGE } from "@/lib/categories";
import type { BrowseResults } from "@/lib/categories/types";

import { InfiniteProductGrid } from "./infinite-product-grid";

// The first five cards are above the fold on a wide screen.
const EAGER_CARDS = 5;

export async function CategoryResults({ results }: { results: Promise<BrowseResults> }) {
  const { cursor, products, sort, source } = await results;
  if (products.length === 0)
    return (
      <div className="py-10 text-center">
        <h2 className="mb-2 text-2xl">Niciun produs deocamdată</h2>
        <p className="text-muted-foreground">Revino curând sau caută în toate produsele.</p>
      </div>
    );
  return (
    <InfiniteProductGrid
      cursor={cursor}
      handles={products.map((product) => product.handle)}
      key={`${JSON.stringify(source)}:${sort}`}
      sort={sort}
      source={source}
    >
      {products.map((product, index) => (
        <ProductCard
          key={product.handle}
          loading={index < EAGER_CARDS ? "eager" : "lazy"}
          product={product}
        />
      ))}
    </InfiniteProductGrid>
  );
}

export function BrowseResultsFallback() {
  return (
    <ProductsGridSkeleton
      className="sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5"
      count={PRODUCTS_PER_PAGE}
    />
  );
}
