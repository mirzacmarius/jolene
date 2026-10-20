/**
 * jolene.ro's WooCommerce catalog as pulled from its Store API on
 * 19 October 2026 (products.json, categories.json and image-labels.json in
 * /mnt/project-files/jolene-catalog), only as far as the lift reads it.
 */

export type WooProduct = {
  id: number;
  name: string;
  slug: string;
  permalink: string;
  categories: { id: number; name: string; slug: string }[];
  tags: string[];
  price: {
    currency: string;
    price: number;
    regular: number;
    sale: number | null;
  };
  short_description_html: string | null;
  description_html: string | null;
  /** The fields of the store's product options plugin (PPOM). */
  options: WooField[];
  images: WooImage[];
};

export type WooField = {
  name: string;
  type: "select" | "text" | "textarea" | "email";
  label: string | null;
  conditional: boolean;
  options?: { label: string; price: string | null }[];
};

export type WooImage = {
  url: string;
  /** WordPress's copy at most 2560 pixels wide, or the original when smaller. */
  scaled_url: string;
  filename: string;
  alt: string;
};

export type WooCategory = {
  id: number;
  name: string;
  slug: string;
  parent: number;
};

/** The size of an image as downloaded from its `url`. */
export type ImageLabel = {
  path: string;
  width: number;
  height: number;
  bytes: number;
};
