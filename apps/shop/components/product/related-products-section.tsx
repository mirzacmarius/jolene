import { Suspense } from "react";

import { ProductCard } from "@/components/product-card/product-card";
import { ProductsGridSkeleton } from "@/components/product/products-grid";
import { getRelatedProducts } from "@/lib/product/server";

const TITLE = "Din aceeași categorie";

interface RelatedProductsSectionProps {
  category: string;
  handle: string;
  limit: number;
}

export function RelatedProductsSection(props: RelatedProductsSectionProps) {
  return (
    <Suspense
      fallback={
        <div className="grid gap-4">
          <h2 className="text-2xl sm:text-3xl">{TITLE}</h2>
          <ProductsGridSkeleton count={props.limit} />
        </div>
      }
    >
      <RelatedProducts {...props} />
    </Suspense>
  );
}

async function RelatedProducts({ category, handle, limit }: RelatedProductsSectionProps) {
  const related = await getRelatedProducts({ category, handle, limit });
  if (related.length === 0) return null;
  return (
    <div className="grid gap-4">
      <h2 className="text-2xl sm:text-3xl">{TITLE}</h2>
      <div className="grid grid-cols-2 gap-5 lg:grid-cols-4">
        {related.map((product) => (
          <ProductCard key={product.handle} product={product} />
        ))}
      </div>
    </div>
  );
}
