import { Link } from "@/components/ui/link";
import type { ProductCard as ProductCardType } from "@/lib/product/types";

import {
  ProductCardContent,
  ProductCardImage,
  ProductCardImageContainer,
  ProductCardPrice,
  ProductCard as ProductCardRoot,
  ProductCardSkeleton,
  ProductCardTitle,
} from "./components";

export interface ProductCardProps {
  loading?: "eager" | "lazy";
  product: ProductCardType;
}

export function ProductCard({ loading, product }: ProductCardProps) {
  return (
    <ProductCardRoot>
      <ProductCardImageContainer>
        <ProductCardImage images={product.images} loading={loading} title={product.title} />
        <ProductCardContent>
          <ProductCardTitle>
            <Link className="after:absolute after:inset-0" href={`/products/${product.handle}`}>
              {product.title}
            </Link>
          </ProductCardTitle>
          <ProductCardPrice compareAtPrice={product.compareAtPrice} price={product.price} />
        </ProductCardContent>
      </ProductCardImageContainer>
    </ProductCardRoot>
  );
}

export { ProductCardSkeleton };
