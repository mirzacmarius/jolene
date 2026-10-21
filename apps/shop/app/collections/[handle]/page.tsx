import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { CategoryResults } from "@/components/categories/browse";
import { CategoryBrowseBoundary, SearchParamsProbe } from "@/components/categories/category-page";
import { getBrowseSource } from "@/lib/categories";
import { getBrowseResults, getCategoryMetadata } from "@/lib/categories/server";
import { PLACEHOLDER_HANDLE } from "@/lib/static-params";

export async function generateMetadata({
  params,
}: PageProps<"/collections/[handle]">): Promise<Metadata> {
  const { handle } = await params;
  if (handle === PLACEHOLDER_HANDLE) notFound();
  return getCategoryMetadata(handle);
}

export default function CategoryPage({ params, searchParams }: PageProps<"/collections/[handle]">) {
  return (
    <CategoryBrowseBoundary>
      <DefaultCategoryResults params={params} searchParams={searchParams} />
    </CategoryBrowseBoundary>
  );
}

async function DefaultCategoryResults({
  params,
  searchParams,
}: PageProps<"/collections/[handle]">) {
  const { handle } = await params;
  return (
    <>
      <CategoryResults
        results={getBrowseResults({ sort: "manual", source: getBrowseSource(handle) })}
      />
      <SearchParamsProbe searchParams={searchParams} />
    </>
  );
}
