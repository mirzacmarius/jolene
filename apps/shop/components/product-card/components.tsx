import { cn } from "cn";
import Image from "next/image";
import type { ComponentProps } from "react";

import { DiscountBadge } from "@/components/product/discount-badge";
import { Price } from "@/components/product/price";
import { ImagePlaceholder } from "@/components/ui/image-placeholder";
import type { Image as ImageType } from "@/lib/media/types";
import { getDiscountPercent } from "@/lib/product";

function ProductCard({ className, children, ...props }: ComponentProps<"article">) {
  return (
    <article
      data-slot="product-card"
      className={cn("group relative flex flex-col h-full overflow-hidden", className)}
      {...props}
    >
      {children}
    </article>
  );
}

function ProductCardImageContainer({ className, children, ...props }: ComponentProps<"div">) {
  return (
    <div
      data-slot="product-card-image-container"
      className={cn("flex flex-col", className)}
      {...props}
    >
      {children}
    </div>
  );
}

interface ProductCardImageProps {
  className?: string;
  images: ImageType[];
  loading?: "eager" | "lazy";
  title: string;
}

// A second photo, when there is one, fades in on hover.
function ProductCardImage({ className, images, loading = "lazy", title }: ProductCardImageProps) {
  const [first, second] = images;
  return (
    <div
      data-slot="product-card-image"
      className={cn("relative aspect-square overflow-hidden bg-accent", className)}
    >
      {first ? (
        <Image
          alt={first.altText || title}
          className="absolute inset-0 size-full object-cover"
          fill
          loading={loading}
          sizes="100vw"
          src={first.url}
        />
      ) : (
        <ImagePlaceholder className="size-full" />
      )}
      {second ? (
        <Image
          alt=""
          className="absolute inset-0 size-full object-cover opacity-0 transition-opacity duration-300 group-hover:opacity-100"
          fill
          loading="lazy"
          sizes="100vw"
          src={second.url}
        />
      ) : null}
    </div>
  );
}

function ProductCardContent({ className, children, ...props }: ComponentProps<"div">) {
  return (
    <div
      data-slot="product-card-content"
      className={cn("flex flex-col flex-1 py-2.5", className)}
      {...props}
    >
      {children}
    </div>
  );
}

function ProductCardTitle({ className, children, ...props }: ComponentProps<"h3">) {
  return (
    <h3
      data-slot="product-card-title"
      className={cn("text-sm font-medium text-foreground line-clamp-1", className)}
      {...props}
    >
      {children}
    </h3>
  );
}

interface ProductCardPriceProps {
  className?: string;
  compareAtPrice?: number;
  price: number;
}

function ProductCardPrice({ className, compareAtPrice, price }: ProductCardPriceProps) {
  const discountPercent = getDiscountPercent(price, compareAtPrice);
  return (
    <div data-slot="product-card-price" className={cn(className)}>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <Price amount={price} className="text-sm text-foreground" />
        {discountPercent && compareAtPrice ? (
          <>
            <Price amount={compareAtPrice} className="text-xs text-muted-foreground line-through" />
            <DiscountBadge percent={discountPercent} />
          </>
        ) : null}
      </div>
    </div>
  );
}

function ProductCardSkeleton({ className }: { className?: string }) {
  return (
    <div
      data-slot="product-card-skeleton"
      className={cn("flex flex-col overflow-hidden", className)}
    >
      <ImagePlaceholder className="aspect-square animate-pulse" />
      <div className="py-2.5 h-12 box-content grid gap-2">
        <div className="h-4 w-full bg-accent animate-pulse" />
        <div className="h-4 w-12 bg-accent animate-pulse" />
      </div>
    </div>
  );
}

export {
  ProductCard,
  ProductCardContent,
  ProductCardImage,
  ProductCardImageContainer,
  ProductCardPrice,
  ProductCardSkeleton,
  ProductCardTitle,
};
