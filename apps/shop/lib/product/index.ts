import type { api } from "@jolene/backend/convex/_generated/api";
import type { FunctionReturnType } from "convex/server";

import { htmlToText } from "@/lib/content";
import type { Image } from "@/lib/media/types";

import type { ProductCard, ProductDetails, ProductOption, SelectedOptions } from "./types";

type ConvexCard = FunctionReturnType<typeof api.shop.search>[number];
type ConvexProduct = NonNullable<FunctionReturnType<typeof api.shop.product>>;

export function toImage({ alt, url }: { alt: string; url: string }): Image {
  return { altText: alt, url };
}

export function toProductCard(card: ConvexCard): ProductCard {
  return {
    compareAtPrice: card.compareAtPrice,
    handle: card.handle,
    images: card.images.map(toImage),
    minQuantity: card.minQuantity,
    price: card.price,
    title: card.title,
  };
}

export function toProductDetails(product: ConvexProduct): ProductDetails {
  return {
    categories: product.categories.map(({ handle, title }) => ({
      handle,
      path: `/collections/${handle}`,
      title,
    })),
    compareAtPrice: product.compareAtPrice,
    description: htmlToText(product.descriptionHtml),
    descriptionHtml: product.descriptionHtml,
    fees: product.fees,
    handle: product.handle,
    images: product.images.map(toImage),
    lineOptions: product.lineOptions.map(({ handle: _, ...option }) => option),
    minQuantity: product.minQuantity,
    options: product.options,
    price: product.price,
    tags: product.tags,
    title: product.title,
  };
}

// jolene.ro preselected each option's first value, which is almost always the paper the price includes.
export function getDefaultSelectedOptions(options: ProductOption[]): SelectedOptions {
  return Object.fromEntries(
    options.flatMap((option) => (option.values[0] ? [[option.name, option.values[0].name]] : [])),
  );
}

/** What the picked values add to each one ordered, in bani. */
export function getSurcharges(options: ProductOption[], selected: SelectedOptions): number {
  return options.reduce(
    (sum, option) =>
      sum + (option.values.find((value) => value.name === selected[option.name])?.surcharge ?? 0),
    0,
  );
}

export function isMarkedDown(
  price: number,
  compareAtPrice: number | undefined,
): compareAtPrice is number {
  return compareAtPrice !== undefined && compareAtPrice > price;
}

export function getDiscountPercent(price: number, compareAtPrice: number | undefined) {
  return isMarkedDown(price, compareAtPrice)
    ? Math.round(((compareAtPrice - price) / compareAtPrice) * 100)
    : null;
}
