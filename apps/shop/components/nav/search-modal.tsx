"use client";

import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { Search, X } from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  type FormEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  useEffect,
  useRef,
  useState,
} from "react";

import { Price } from "@/components/product/price";
import { Dialog, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import type { Image as ImageType } from "@/lib/media/types";
import { useRecentlyViewedProducts } from "@/lib/product/client";
import { getSearchUrl } from "@/lib/search";
import { useProductSuggestions } from "@/lib/search/client";

interface ResultProduct {
  handle: string;
  image: ImageType | null;
  price: number;
  title: string;
}

export function SearchModal() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    function handleShortcut(event: KeyboardEvent) {
      if (event.key === "k" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        setOpen((current) => !current);
      }
    }
    document.addEventListener("keydown", handleShortcut);
    return () => document.removeEventListener("keydown", handleShortcut);
  }, []);

  return (
    <Dialog onOpenChange={setOpen} open={open}>
      <DialogTrigger
        render={
          <button
            className="flex items-center justify-center text-foreground transition-colors hover:text-foreground/80"
            type="button"
          >
            <Search className="size-5" />
            <span className="sr-only">Caută</span>
          </button>
        }
      />
      {open ? <SearchDialogContent onClose={() => setOpen(false)} /> : null}
    </Dialog>
  );
}

function SearchDialogContent({ onClose }: { onClose: () => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(-1);
  const suggestions = useProductSuggestions(query);
  const recentlyViewed = useRecentlyViewedProducts(true);
  const hasQuery = query.trim().length > 0;
  // An empty query shows what the visitor looked at last, so both states drive one keyboard list.
  const products: ResultProduct[] = hasQuery
    ? (suggestions ?? []).map(({ handle, images, price, title }) => ({
        handle,
        image: images[0] ?? null,
        price,
        title,
      }))
    : recentlyViewed;
  const isLoading = hasQuery && suggestions === undefined;

  function navigate(href: string) {
    router.push(href);
    requestAnimationFrame(onClose);
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const term = query.trim();
    if (term) navigate(getSearchUrl(term));
  }

  function handleKeyDown(event: ReactKeyboardEvent) {
    if (event.key === "ArrowDown" && products.length > 0) {
      event.preventDefault();
      setActiveIndex(Math.min(activeIndex + 1, products.length - 1));
    } else if (event.key === "ArrowUp" && products.length > 0) {
      event.preventDefault();
      setActiveIndex(Math.max(activeIndex - 1, -1));
    } else if (event.key === "Enter" && activeIndex >= 0) {
      event.preventDefault();
      const product = products[activeIndex];
      if (product) navigate(`/products/${product.handle}`);
    }
  }

  const show = hasQuery || products.length > 0;
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Backdrop className="data-open:animate-in data-closed:animate-out data-closed:fade-out-0 data-open:fade-in-0 fixed inset-0 z-60 bg-black/30 backdrop-blur-sm" />
      <DialogPrimitive.Popup
        aria-describedby={undefined}
        className="fixed inset-0 z-60 flex justify-center px-4 pt-[15vh] outline-none"
        initialFocus={inputRef}
        onClick={(event) => {
          if (event.target === event.currentTarget) onClose();
        }}
      >
        <div className="h-fit w-full max-w-xl">
          <DialogTitle className="sr-only">Caută</DialogTitle>
          <div className="overflow-hidden rounded-xl bg-background shadow-lg duration-200">
            <form className="flex items-center gap-3 px-4 py-3" onSubmit={handleSubmit}>
              <Search className="size-4 shrink-0 text-foreground/40" />
              <input
                aria-activedescendant={
                  activeIndex >= 0 ? `search-modal-item-${activeIndex}` : undefined
                }
                aria-controls="search-modal-results"
                aria-expanded={show}
                autoComplete="off"
                className="min-w-0 flex-1 bg-transparent text-base text-foreground placeholder:text-foreground/40 focus:outline-none"
                maxLength={100}
                name="q"
                onChange={(event) => {
                  setQuery(event.target.value);
                  setActiveIndex(-1);
                }}
                onKeyDown={handleKeyDown}
                placeholder="Caută invitații, mărturii, meniuri…"
                ref={inputRef}
                role="combobox"
                type="text"
                value={query}
              />
              {hasQuery ? (
                <button
                  className="shrink-0 text-sm text-foreground/60 transition-colors hover:text-foreground"
                  onClick={() => {
                    setQuery("");
                    setActiveIndex(-1);
                    inputRef.current?.focus();
                  }}
                  type="button"
                >
                  Șterge
                </button>
              ) : null}
              <DialogPrimitive.Close className="flex shrink-0 items-center justify-center rounded-full text-foreground/40 transition-colors hover:text-foreground">
                <X className="size-4" />
                <span className="sr-only">Închide</span>
              </DialogPrimitive.Close>
            </form>

            {show ? (
              <div
                className="max-h-[60vh] overflow-y-auto overscroll-contain border-t border-border/30"
                id="search-modal-results"
                role="listbox"
              >
                {isLoading ? (
                  <LoadingSkeleton />
                ) : (
                  <>
                    {products.length > 0 ? (
                      <div>
                        <div className="px-4 pt-3 pb-1.5 text-xs font-medium tracking-wider text-foreground/50 uppercase">
                          {hasQuery ? "Produse" : "Văzute recent"}
                        </div>
                        {products.map((product, index) => (
                          <ProductResult
                            active={activeIndex === index}
                            id={`search-modal-item-${index}`}
                            key={product.handle}
                            onNavigate={navigate}
                            product={product}
                          />
                        ))}
                      </div>
                    ) : null}
                    {hasQuery && products.length === 0 ? (
                      <div className="px-4 py-6 text-center text-sm text-foreground/50">
                        Niciun produs pentru „{query.trim()}”
                      </div>
                    ) : null}
                    {hasQuery && products.length > 0 ? (
                      <div className="flex justify-center px-4 py-3">
                        <button
                          className="inline-flex h-9 items-center justify-center rounded-lg bg-primary px-5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
                          onClick={() => navigate(getSearchUrl(query.trim()))}
                          type="button"
                        >
                          Vezi toate rezultatele
                        </button>
                      </div>
                    ) : null}
                  </>
                )}
              </div>
            ) : null}
          </div>
        </div>
      </DialogPrimitive.Popup>
    </DialogPrimitive.Portal>
  );
}

interface ProductResultProps {
  active: boolean;
  id: string;
  onNavigate: (href: string) => void;
  product: ResultProduct;
}

function ProductResult({ active, id, onNavigate, product }: ProductResultProps) {
  return (
    <button
      aria-selected={active}
      className="flex w-full cursor-pointer items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-accent/50 data-[active=true]:bg-accent/50"
      data-active={active}
      id={id}
      onClick={() => onNavigate(`/products/${product.handle}`)}
      role="option"
      type="button"
    >
      <div className="relative size-14 shrink-0 overflow-hidden bg-muted">
        {product.image ? (
          <Image
            alt={product.image.altText || product.title}
            className="object-cover"
            fill
            sizes="100vw"
            src={product.image.url}
          />
        ) : null}
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm text-foreground">{product.title}</div>
        <Price amount={product.price} className="text-sm text-foreground/70" />
      </div>
    </button>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-3 px-4 py-3" role="status">
      <span className="sr-only">Se caută…</span>
      <div className="h-3 w-24 animate-pulse rounded bg-accent/40" />
      {["skeleton-1", "skeleton-2", "skeleton-3"].map((key) => (
        <div className="flex items-center gap-3 py-2.5" key={key}>
          <div className="size-14 shrink-0 animate-pulse bg-accent" />
          <div className="flex-1 space-y-1.5">
            <div className="h-3.5 w-3/4 animate-pulse rounded bg-accent" />
            <div className="h-3 w-1/3 animate-pulse rounded bg-accent" />
          </div>
        </div>
      ))}
    </div>
  );
}
