import { cn } from "cn";

import { ProductCardSkeleton } from "@/components/product-card/product-card";

interface ProductsGridSkeletonProps {
  className?: string;
  count: number;
}

export function ProductsGridSkeleton({ className, count }: ProductsGridSkeletonProps) {
  return (
    <div className={cn("grid grid-cols-2 gap-5 lg:grid-cols-4", className)}>
      {Array.from({ length: count }, (_, index) => (
        <ProductCardSkeleton key={index} />
      ))}
    </div>
  );
}
