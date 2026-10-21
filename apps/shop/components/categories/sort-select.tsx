"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";

import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/select";
import { parseSort, SORT_VALUES } from "@/lib/categories";
import type { SortValue } from "@/lib/categories/types";

const SORT_LABELS: Record<SortValue, string> = {
  manual: "Recomandate",
  "price-ascending": "Preț crescător",
  "price-descending": "Preț descrescător",
};

// Reads the URL, so it renders under a Suspense boundary and the list around it stays static.
export function SortSelect() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const sort = parseSort(searchParams.get("sort_by"));

  function choose(value: SortValue) {
    const params = new URLSearchParams(searchParams);
    if (value === "manual") params.delete("sort_by");
    else params.set("sort_by", value);
    const search = params.toString();
    startTransition(() =>
      router.push(search ? `${pathname}?${search}` : pathname, { scroll: false }),
    );
  }

  return (
    <Select disabled={isPending} onValueChange={(value) => choose(parseSort(value))} value={sort}>
      <SelectTrigger aria-label="Ordonează" className="border-0 bg-transparent px-0 shadow-none">
        <span>{SORT_LABELS[sort]}</span>
      </SelectTrigger>
      <SelectContent>
        {SORT_VALUES.map((value) => (
          <SelectItem key={value} value={value}>
            {SORT_LABELS[value]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function SortSelectFallback() {
  return (
    <div className="flex h-9 w-fit items-center gap-2 text-sm whitespace-nowrap">
      {SORT_LABELS.manual}
    </div>
  );
}
