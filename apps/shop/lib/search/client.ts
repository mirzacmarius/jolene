"use client";

import { useEffect, useState } from "react";

import type { ProductCard } from "@/lib/product/types";
import { suggestProductsAction } from "@/lib/search/action";

const DEBOUNCE_MS = 300;

/** The products a term finds as it's typed: undefined while asking, empty when it finds none. */
export function useProductSuggestions(query: string): ProductCard[] | undefined {
  const term = query.trim();
  const [answer, setAnswer] = useState<{ products: ProductCard[]; term: string }>();
  useEffect(() => {
    if (!term) return;
    let isCurrent = true;
    const timeout = setTimeout(() => {
      suggestProductsAction(term)
        .catch(() => [])
        .then((products) => {
          if (isCurrent) setAnswer({ products, term });
        });
    }, DEBOUNCE_MS);
    return () => {
      isCurrent = false;
      clearTimeout(timeout);
    };
  }, [term]);
  if (!term) return [];
  return answer?.term === term ? answer.products : undefined;
}
