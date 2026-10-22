"use client";

import { cn } from "@jolene/ui/utils";
import Image from "next/image";
import { optimizable } from "@/lib/photos";

/** One of Jolene's photos of a product, as Convex gives it. */
export interface ProductPhoto {
  url: string;
  alt: string;
}

/**
 * A product's photo filling its frame, which the caller sizes. `sizes` says
 * how wide the frame is on each screen, so each gets a photo that fits it.
 */
export function Photo({
  photo,
  sizes,
  decorative = false,
  preload = false,
  className,
}: {
  photo: ProductPhoto;
  sizes: string;
  /** Inside a control or link that already names it. */
  decorative?: boolean;
  /** The page's largest picture, which loads first. */
  preload?: boolean;
  className?: string;
}) {
  return (
    <Image
      src={photo.url}
      alt={decorative ? "" : photo.alt}
      fill
      sizes={sizes}
      preload={preload}
      unoptimized={!optimizable(photo.url)}
      className={cn("object-cover", className)}
    />
  );
}
