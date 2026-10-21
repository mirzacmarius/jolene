import { type ReactNode, Suspense } from "react";

import { BreadcrumbSchema } from "@/components/schema/breadcrumb-schema";
import { CategorySchema } from "@/components/schema/category-schema";
import { Container } from "@/components/ui/container";
import { Link } from "@/components/ui/link";
import { Page } from "@/components/ui/page";
import { Sections } from "@/components/ui/sections";
import { Skeleton } from "@/components/ui/skeleton";
import { describeCategory } from "@/lib/categories";
import type { Category } from "@/lib/categories/types";
import { shopConfig } from "@/lib/config";

import { BrowseResultsFallback } from "./browse";
import { BrowseFallback, BrowseToolbar } from "./toolbar";

interface CategoryLayoutProps {
  category: Category;
  children: ReactNode;
}

// The default and refine routes share this layout, so the header and toolbar stay mounted when the sort changes.
export function CategoryLayout({ category, children }: CategoryLayoutProps) {
  const description = describeCategory(category);
  return (
    <Page className="pt-2.5 md:pt-10">
      <Container>
        <Sections className="gap-5">
          <BreadcrumbSchema
            items={[
              { name: shopConfig.site.name, path: "/" },
              { name: category.title, path: category.path },
            ]}
          />
          <CategorySchema category={category} description={description} />
          <div>
            <h1 className="text-3xl sm:text-4xl md:text-5xl">
              <Link href={category.path}>{category.title}</Link>
            </h1>
            <p className="mt-1 leading-6 text-muted-foreground">{description}</p>
          </div>
          <BrowseToolbar />
          {children}
        </Sections>
      </Container>
    </Page>
  );
}

// Wraps every category page's results; the first sort from the default view shows this grid skeleton while the refine route loads.
export function CategoryBrowseBoundary({ children }: { children: ReactNode }) {
  return <Suspense fallback={<BrowseResultsFallback />}>{children}</Suspense>;
}

// The static default view otherwise renders from the client cache for any search string; reading search params makes the router ask the server, which proxy.ts rewrites to the refine route.
export function SearchParamsProbe({ searchParams }: { searchParams: Promise<unknown> }) {
  return (
    <Suspense fallback={null}>
      <SearchParamsRead searchParams={searchParams} />
    </Suspense>
  );
}

async function SearchParamsRead({ searchParams }: { searchParams: Promise<unknown> }) {
  await searchParams;
  return null;
}

export function CategoryDetailSkeleton() {
  return (
    <Page aria-busy="true" className="pt-2.5 md:pt-10">
      <Container>
        <Sections className="gap-5">
          <div className="grid gap-2.5">
            <Skeleton className="h-9 w-64 sm:h-10 md:h-12 md:w-80" />
            <Skeleton className="h-4 w-full max-w-xl" />
          </div>
          <BrowseFallback />
        </Sections>
      </Container>
    </Page>
  );
}
