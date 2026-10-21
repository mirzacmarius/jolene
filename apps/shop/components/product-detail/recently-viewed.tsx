"use client";

import { useEffect } from "react";

import { recordRecentlyViewedProduct } from "@/lib/product/client";
import type { RecentlyViewedProduct } from "@/lib/product/types";

export function RecentlyViewedRecorder({ product }: { product: RecentlyViewedProduct }) {
  const { handle, image, price, title } = product;
  useEffect(() => {
    recordRecentlyViewedProduct({ handle, image, price, title });
  }, [handle, image, price, title]);
  return null;
}
