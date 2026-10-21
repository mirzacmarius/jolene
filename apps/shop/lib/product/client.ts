"use client";

import { useState } from "react";

import type { RecentlyViewedProduct } from "./types";

const RECENTLY_VIEWED_KEY = "jolene-recently-viewed-v1";
const RECENTLY_VIEWED_LIMIT = 4;

function readRecentlyViewedProducts(): RecentlyViewedProduct[] {
  try {
    const stored: unknown = JSON.parse(localStorage.getItem(RECENTLY_VIEWED_KEY) ?? "null");
    return Array.isArray(stored)
      ? (stored as RecentlyViewedProduct[]).slice(0, RECENTLY_VIEWED_LIMIT)
      : [];
  } catch {
    return [];
  }
}

export function recordRecentlyViewedProduct(product: RecentlyViewedProduct): void {
  try {
    const previous = readRecentlyViewedProducts().filter((item) => item.handle !== product.handle);
    localStorage.setItem(
      RECENTLY_VIEWED_KEY,
      JSON.stringify([product, ...previous].slice(0, RECENTLY_VIEWED_LIMIT)),
    );
  } catch {
    /* The search dialog still works without browser storage. */
  }
}

// Re-read on each open: the dialog outlives navigation, so a product page may have recorded a view since last time.
export function useRecentlyViewedProducts(open: boolean): RecentlyViewedProduct[] {
  const [state, setState] = useState({ open: false, products: [] as RecentlyViewedProduct[] });
  if (state.open !== open) {
    setState({ open, products: open ? readRecentlyViewedProducts() : [] });
  }
  return state.products;
}
