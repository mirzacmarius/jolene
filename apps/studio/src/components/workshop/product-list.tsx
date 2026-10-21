"use client";

import { api } from "@jolene/backend/convex/_generated/api";
import { Badge } from "@jolene/ui/badge";
import { Button } from "@jolene/ui/button";
import { Input } from "@jolene/ui/input";
import { SegmentedControl } from "@jolene/ui/segmented-control";
import { Skeleton } from "@jolene/ui/skeleton";
import { usePaginatedQuery, useQuery } from "convex/react";
import { Search } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useI18n } from "@/locales/client";
import { useFormats } from "./formats";

/** How many products the list shows at first, and adds each time. */
const PAGE_SIZE = 30;

/** How long typing pauses before the list searches for it. */
const SEARCH_DELAY = 250;

const TABS = ["forSale", "offSale"] as const;

type Tab = (typeof TABS)[number];

const selectClass =
  "h-10 w-full min-w-0 rounded-lg border border-input bg-card px-3 text-[15px] shadow-xs outline-none transition-[border-color,box-shadow] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/30 disabled:cursor-not-allowed disabled:opacity-50 sm:w-60";

/** `value`, once it has stayed the same for `delay` milliseconds. */
function useSettled(value: string, delay: number) {
  const [settled, setSettled] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setSettled(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return settled;
}

/**
 * The shop's products, for sale or taken off sale: all of them or a
 * category's, in the shop's order, or those whose names match a search.
 * Each opens on its own page.
 */
export function ProductList() {
  const t = useI18n();
  const [tab, setTab] = useState<Tab>("forSale");
  const [category, setCategory] = useState("");
  const [text, setText] = useState("");
  const search = useSettled(text.trim(), SEARCH_DELAY);
  const categories = useQuery(api.workshop.products.categories, {});
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
          <SegmentedControl
            value={tab}
            onValueChange={setTab}
            options={TABS.map((value) => ({
              value,
              label: t(`workshop.catalog.tabs.${value}`),
            }))}
            label={t("workshop.catalog.show")}
            className="w-max"
          />
        </div>
        <div className="flex flex-col gap-3 sm:flex-row lg:ml-auto">
          <select
            aria-label={t("workshop.catalog.category")}
            value={category}
            onChange={(event) => setCategory(event.target.value)}
            disabled={search !== ""}
            className={selectClass}
          >
            <option value="">{t("workshop.catalog.allCategories")}</option>
            {categories?.map((option) => (
              <option key={option.handle} value={option.handle}>
                {option.title}
              </option>
            ))}
          </select>
          <div className="relative sm:w-72">
            <Search
              className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <Input
              type="search"
              value={text}
              onChange={(event) => setText(event.target.value)}
              placeholder={t("workshop.catalog.search")}
              aria-label={t("workshop.catalog.search")}
              className="pl-9"
            />
          </div>
        </div>
      </div>
      {search !== "" && category !== "" ? (
        <p className="-mt-3 text-sm text-muted-foreground">
          {t("workshop.catalog.searching")}
        </p>
      ) : null}
      <Products
        published={tab === "forSale"}
        category={search === "" && category !== "" ? category : undefined}
        search={search === "" ? undefined : search}
      />
    </div>
  );
}

function Products({
  published,
  category,
  search,
}: {
  published: boolean;
  category?: string;
  search?: string;
}) {
  const t = useI18n();
  const format = useFormats();
  const { results, status, loadMore } = usePaginatedQuery(
    api.workshop.products.list,
    { published, category, search },
    { initialNumItems: PAGE_SIZE },
  );
  if (status === "LoadingFirstPage")
    return (
      <div className="flex flex-col gap-3">
        {[0, 1, 2].map((key) => (
          <Skeleton key={key} className="h-20 rounded-2xl" />
        ))}
      </div>
    );
  if (results.length === 0)
    return (
      <p className="rounded-3xl border border-dashed p-10 text-muted-foreground">
        {t("workshop.catalog.empty")}
      </p>
    );
  return (
    <div className="flex flex-col items-start gap-6">
      <ol className="w-full divide-y overflow-hidden rounded-3xl border bg-card">
        {results.map((product) => (
          <li key={product.handle}>
            <Link
              href={`/studio/atelier/produse/${product.handle}`}
              className="flex items-center gap-4 px-5 py-3 transition-colors hover:bg-secondary/50"
            >
              {product.image ? (
                <img
                  src={product.image.url}
                  alt=""
                  loading="lazy"
                  className="size-14 shrink-0 rounded-xl bg-secondary/70 object-cover"
                />
              ) : (
                <span className="size-14 shrink-0 rounded-xl bg-secondary/70" />
              )}
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span className="font-medium">{product.title}</span>
                  {product.editedAt !== undefined ? (
                    <Badge variant="outline">
                      {t("workshop.catalog.edited")}
                    </Badge>
                  ) : null}
                </span>
                <span className="block truncate text-sm text-muted-foreground">
                  {product.forEvent
                    ? t("workshop.catalog.forEvent")
                    : product.categories.length > 0
                      ? product.categories.join(", ")
                      : t("workshop.catalog.noCategory")}
                </span>
              </span>
              <span className="shrink-0 text-right text-sm">
                <span className="block font-medium">
                  {t("workshop.catalog.each", {
                    price: format.lei(product.price),
                  })}
                </span>
                {product.compareAtPrice !== undefined ? (
                  <span className="block text-muted-foreground line-through">
                    {format.lei(product.compareAtPrice)}
                  </span>
                ) : null}
                {product.minQuantity !== undefined ? (
                  <span className="block text-muted-foreground">
                    {t("workshop.catalog.minimum", {
                      count: product.minQuantity,
                    })}
                  </span>
                ) : null}
              </span>
            </Link>
          </li>
        ))}
      </ol>
      {status === "CanLoadMore" || status === "LoadingMore" ? (
        <Button
          variant="outline"
          disabled={status === "LoadingMore"}
          onClick={() => loadMore(PAGE_SIZE)}
        >
          {t("workshop.loadMore")}
        </Button>
      ) : null}
    </div>
  );
}
