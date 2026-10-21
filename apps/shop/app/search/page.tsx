import type { Metadata } from "next";
import { Suspense } from "react";

import { BrowseResultsFallback } from "@/components/categories/browse";
import { BrowseToolbar } from "@/components/categories/toolbar";
import { ProductCard } from "@/components/product-card/product-card";
import { Container } from "@/components/ui/container";
import { Link } from "@/components/ui/link";
import { Page } from "@/components/ui/page";
import { Sections } from "@/components/ui/sections";
import { parseSort } from "@/lib/categories";
import { formatCount } from "@/lib/content";
import { getSearchResults } from "@/lib/search/server";
import type { SearchResults } from "@/lib/search/types";
import { buildAlternates, buildOpenGraph } from "@/lib/seo";

type SearchParams = Awaited<PageProps<"/search">["searchParams"]>;

function getParam(searchParams: SearchParams, key: string): string | undefined {
  const value = searchParams[key];
  return Array.isArray(value) ? value[0] : value;
}

export async function generateMetadata({ searchParams }: PageProps<"/search">): Promise<Metadata> {
  const resolved = await searchParams;
  const query = getParam(resolved, "q")?.trim() ?? "";
  const title = query ? `Căutare: ${query}` : "Căutare";
  const description = query
    ? `Produsele Jolene care se potrivesc cu „${query}”.`
    : "Caută printre produsele Jolene.";
  return {
    alternates: buildAlternates({ pathname: "/search", searchParams: resolved }),
    description,
    openGraph: buildOpenGraph({ description, title, type: "website", url: "/search" }),
    robots: { follow: false, index: false },
    title,
    twitter: { card: "summary_large_image", description, images: ["/og-default.png"], title },
  };
}

export default function SearchPage({ searchParams }: PageProps<"/search">) {
  // Not awaited here, which would make the whole route wait on the request.
  const results = searchParams.then((resolved) =>
    getSearchResults({
      query: getParam(resolved, "q") ?? "",
      sort: parseSort(getParam(resolved, "sort_by")),
    }),
  );
  return (
    <Page className="pt-2.5 md:pt-10">
      <Container>
        <Sections className="gap-5">
          <h1 className="text-3xl sm:text-4xl md:text-5xl">
            <Link href="/search">Căutare</Link>
          </h1>
          <BrowseToolbar />
          <Suspense fallback={<BrowseResultsFallback />}>
            <SearchResultsGrid results={results} />
          </Suspense>
        </Sections>
      </Container>
    </Page>
  );
}

async function SearchResultsGrid({ results }: { results: Promise<SearchResults> }) {
  const { products, query } = await results;
  if (!query)
    return (
      <p className="py-10 text-center text-muted-foreground">
        Scrie în căutarea de sus ce produs cauți.
      </p>
    );
  if (products.length === 0)
    return (
      <div className="py-10 text-center">
        <h2 className="mb-2 text-2xl">Niciun produs pentru „{query}”</h2>
        <p className="text-muted-foreground">
          Încearcă alt cuvânt sau <Link href="/collections/all">toate produsele</Link>.
        </p>
      </div>
    );
  return (
    <div className="grid gap-5">
      <p className="text-sm text-muted-foreground" role="status">
        {formatCount(products.length, { few: "produse", one: "produs", other: "de produse" })}{" "}
        pentru „{query}”
      </p>
      <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {products.map((product, index) => (
          <ProductCard
            key={product.handle}
            loading={index < 5 ? "eager" : "lazy"}
            product={product}
          />
        ))}
      </div>
    </div>
  );
}
