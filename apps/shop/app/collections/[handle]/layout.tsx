import { notFound } from "next/navigation";
import { Suspense } from "react";

import { CategoryDetailSkeleton, CategoryLayout } from "@/components/categories/category-page";
import { ALL_PRODUCTS_HANDLE } from "@/lib/categories";
import { getCategories, getCategory } from "@/lib/categories/server";
import { PLACEHOLDER_HANDLE } from "@/lib/static-params";

export async function generateStaticParams() {
  try {
    const categories = await getCategories();
    return [{ handle: ALL_PRODUCTS_HANDLE }, ...categories.map(({ handle }) => ({ handle }))];
  } catch {
    return [{ handle: PLACEHOLDER_HANDLE }];
  }
}

export default function CategoryHandleLayout({
  children,
  params,
}: LayoutProps<"/collections/[handle]">) {
  return (
    <Suspense fallback={<CategoryDetailSkeleton />}>
      <CategoryHandleLayoutContent params={params}>{children}</CategoryHandleLayoutContent>
    </Suspense>
  );
}

async function CategoryHandleLayoutContent({
  children,
  params,
}: Pick<LayoutProps<"/collections/[handle]">, "children" | "params">) {
  const { handle } = await params;
  if (handle === PLACEHOLDER_HANDLE) notFound();
  const category = await getCategory(handle);
  if (!category) notFound();
  return <CategoryLayout category={category}>{children}</CategoryLayout>;
}
