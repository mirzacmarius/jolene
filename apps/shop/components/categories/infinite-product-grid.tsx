"use client";

import { LoaderCircleIcon } from "lucide-react";
import { type ReactNode, useEffect, useEffectEvent, useRef, useState } from "react";

import { ProductCard } from "@/components/product-card/product-card";
import { Button } from "@/components/ui/button";
import { loadMoreProductsAction } from "@/lib/categories/action";
import type { BrowseSource, SortValue } from "@/lib/categories/types";
import type { ProductCard as ProductCardType } from "@/lib/product/types";

interface InfiniteProductGridProps {
  children: ReactNode;
  /** Where the page after the first starts, or null when the first is the only one. */
  cursor: string | null;
  /** The first page's products, so a later page never shows one twice. */
  handles: string[];
  sort: SortValue;
  source: BrowseSource;
}

export function InfiniteProductGrid({
  children,
  cursor: firstCursor,
  handles,
  sort,
  source,
}: InfiniteProductGridProps) {
  const [products, setProducts] = useState<ProductCardType[]>([]);
  const [cursor, setCursor] = useState(firstCursor);
  const [isLoading, setLoading] = useState(false);
  const [hasFailed, setFailed] = useState(false);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const loadingRef = useRef(false);

  const loadMore = useEffectEvent(async () => {
    if (loadingRef.current || !cursor) return;
    loadingRef.current = true;
    setLoading(true);
    setFailed(false);
    try {
      const page = await loadMoreProductsAction({ cursor, sort, source });
      // A product Jolene moved while the visitor scrolls can come again on the next page.
      setProducts((current) => {
        const seen = new Set([...handles, ...current.map((product) => product.handle)]);
        return [...current, ...page.products.filter((product) => !seen.has(product.handle))];
      });
      setCursor(page.cursor);
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
      loadingRef.current = false;
    }
  });

  // Re-armed for each cursor, so a sentinel still in view after a page lands loads the next.
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || !cursor || hasFailed) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) void loadMore();
      },
      { rootMargin: "400px" },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [cursor, hasFailed]);

  return (
    <div>
      <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {children}
        {products.map((product) => (
          <ProductCard key={product.handle} product={product} />
        ))}
      </div>
      {cursor ? (
        <div className="flex justify-center py-10" ref={sentinelRef}>
          {hasFailed ? (
            <Button onClick={() => void loadMore()} variant="outline">
              Arată mai multe produse
            </Button>
          ) : isLoading ? (
            <LoaderCircleIcon
              aria-label="Se încarcă"
              className="size-6 animate-spin text-muted-foreground"
            />
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
