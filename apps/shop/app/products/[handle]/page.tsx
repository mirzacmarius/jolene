import { api } from "@jolene/backend/convex/_generated/api";
import { fetchQuery } from "convex/nextjs";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import {
  ProductDetailSection,
  ProductDetailSkeleton,
} from "@/components/product-detail/product-detail-section";
import { RecentlyViewedRecorder } from "@/components/product-detail/recently-viewed";
import { RelatedProductsSection } from "@/components/product/related-products-section";
import { Container } from "@/components/ui/container";
import { Page } from "@/components/ui/page";
import { Sections } from "@/components/ui/sections";
import { summarizeText } from "@/lib/content";
import { getProduct } from "@/lib/product/server";
import { getProductProof } from "@/lib/proof/server";
import { buildAlternates, buildOpenGraph } from "@/lib/seo";
import { PLACEHOLDER_HANDLE } from "@/lib/static-params";

export async function generateStaticParams() {
  try {
    const { page } = await fetchQuery(api.shop.products, {
      paginationOpts: { cursor: null, numItems: 1 },
    });
    return [{ handle: page[0]?.handle ?? PLACEHOLDER_HANDLE }];
  } catch {
    return [{ handle: PLACEHOLDER_HANDLE }];
  }
}

export async function generateMetadata({
  params,
}: PageProps<"/products/[handle]">): Promise<Metadata> {
  const { handle } = await params;
  if (handle === PLACEHOLDER_HANDLE) return {};
  const product = await getProduct(handle);
  if (!product) notFound();
  const path = `/products/${handle}`;
  const description = summarizeText(product.description);
  const [image] = product.images;
  const images = image
    ? [{ alt: image.altText || product.title, url: image.url }]
    : ["/og-default.png"];
  return {
    alternates: buildAlternates({ pathname: path }),
    description,
    openGraph: buildOpenGraph({ description, images, title: product.title, url: path }),
    title: product.title,
    twitter: { card: "summary_large_image", description, images, title: product.title },
  };
}

export default function ProductPage({ params, searchParams }: PageProps<"/products/[handle]">) {
  return (
    <Page className="pt-0">
      <Container className="bg-background">
        <Sections>
          <Suspense fallback={<ProductDetailSkeleton />}>
            <ProductPageContent params={params} searchParams={searchParams} />
          </Suspense>
        </Sections>
      </Container>
    </Page>
  );
}

async function ProductPageContent({
  params,
  searchParams,
}: Pick<PageProps<"/products/[handle]">, "params" | "searchParams">) {
  const { handle } = await params;
  if (handle === PLACEHOLDER_HANDLE) notFound();
  const product = await getProduct(handle);
  if (!product) notFound();
  const proof = searchParams.then(({ proof: id }) =>
    getProductProof(typeof id === "string" ? id : undefined, handle),
  );
  const [category] = product.categories;
  return (
    <>
      <RecentlyViewedRecorder
        product={{
          handle: product.handle,
          image: product.images[0] ?? null,
          price: product.price,
          title: product.title,
        }}
      />
      <ProductDetailSection product={product} proof={proof} />
      {category ? (
        <RelatedProductsSection category={category.handle} handle={handle} limit={4} />
      ) : null}
    </>
  );
}
