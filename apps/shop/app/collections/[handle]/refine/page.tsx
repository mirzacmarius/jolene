import type { Metadata } from "next";

import { CategoryResults } from "@/components/categories/browse";
import { CategoryBrowseBoundary } from "@/components/categories/category-page";
import { getBrowseSource, parseSort } from "@/lib/categories";
import { getBrowseResults, getCategoryMetadata } from "@/lib/categories/server";

export async function generateMetadata({
  params,
}: PageProps<"/collections/[handle]/refine">): Promise<Metadata> {
  const { handle } = await params;
  return getCategoryMetadata(handle);
}

// proxy.ts rewrites a sorted category view here; the default order stays on the static page.
export default function RefinedCategoryPage({
  params,
  searchParams,
}: PageProps<"/collections/[handle]/refine">) {
  return (
    <CategoryBrowseBoundary>
      <RefinedCategoryResults params={params} searchParams={searchParams} />
    </CategoryBrowseBoundary>
  );
}

async function RefinedCategoryResults({
  params,
  searchParams,
}: PageProps<"/collections/[handle]/refine">) {
  const [{ handle }, { sort_by: sortBy }] = await Promise.all([params, searchParams]);
  return (
    <CategoryResults
      results={getBrowseResults({
        sort: parseSort(typeof sortBy === "string" ? sortBy : undefined),
        source: getBrowseSource(handle),
      })}
    />
  );
}
