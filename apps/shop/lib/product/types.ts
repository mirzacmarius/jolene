import type { Category } from "@/lib/categories/types";
import type { Fee, LineOption } from "@/lib/line-options/types";
import type { Image } from "@/lib/media/types";

export interface ProductCard {
  compareAtPrice?: number;
  handle: string;
  /** On a card, the first two photos: the second shows on hover. */
  images: Image[];
  minQuantity?: number;
  /** Bani, before any paper or paid choice. */
  price: number;
  title: string;
}

export interface ProductDetails extends ProductCard {
  categories: Category[];
  description: string;
  descriptionHtml: string;
  fees: Fee[];
  lineOptions: LineOption[];
  options: ProductOption[];
  tags: string[];
}

/** What a product is made of, such as its paper: the couple picks one value. */
export interface ProductOption {
  name: string;
  values: ProductOptionValue[];
}

export interface ProductOptionValue {
  name: string;
  /** Bani the value adds to each one ordered. */
  surcharge: number;
}

export interface ProductPage {
  /** Where the next page starts, or null after the last. */
  cursor: string | null;
  products: ProductCard[];
}

export interface RecentlyViewedProduct {
  handle: string;
  image: Image | null;
  price: number;
  title: string;
}

/** Each option's picked value, by the option's name. */
export type SelectedOptions = Record<string, string>;
