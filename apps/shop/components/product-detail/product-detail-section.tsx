import { type ComponentProps, Suspense } from "react";

import { InviteImage } from "@/components/invite/invite-card";
import { BreadcrumbSchema } from "@/components/schema/breadcrumb-schema";
import { Skeleton } from "@/components/ui/skeleton";
import { shopConfig } from "@/lib/config";
import type { InviteEvent } from "@/lib/invite/types";
import type { ProductDetails } from "@/lib/product/types";
import type { ProductProof } from "@/lib/proof/types";

import { ProductOpenGraph } from "./open-graph";
import { ProductInfoDescription } from "./product-info";
import { ProductMedia } from "./product-media";
import { PurchaseForm } from "./purchase-form";
import { ProductSchema } from "./schema";
import { StudioOrder } from "./studio-order";

interface ProductDetailSectionProps {
  /** Read from the page's ?event= for a product bought for an event, as the proof is. */
  event: Promise<InviteEvent | null>;
  product: ProductDetails;
  /** Read from the page's ?proof=, so it waits on the request while the rest is static. */
  proof: Promise<ProductProof | null>;
}

export function ProductDetailSection({ event, product, proof }: ProductDetailSectionProps) {
  const [category] = product.categories;
  return (
    <>
      <ProductSchema product={product} />
      <ProductOpenGraph price={product.price} />
      <BreadcrumbSchema
        items={[
          { name: shopConfig.site.name, path: "/" },
          ...(category ? [{ name: category.title, path: category.path }] : []),
          { name: product.title, path: `/products/${product.handle}` },
        ]}
      />
      <div className="grid gap-10 lg:grid-cols-10 lg:items-start lg:gap-5">
        {product.forEvent ? (
          <Suspense fallback={<div className={`${INVITE_MEDIA_CLASS} bg-accent`} />}>
            <ResolvedInviteImage event={event} />
          </Suspense>
        ) : (
          <ProductMedia className="lg:col-span-6" images={product.images} title={product.title} />
        )}
        <div className="grid gap-10 lg:sticky lg:top-20 lg:col-span-4">
          <h1 className="text-foreground text-3xl">{product.title}</h1>
          {product.template ? (
            <Suspense fallback={<StudioOrder product={product} template={product.template} />}>
              <ResolvedStudioOrder product={product} proof={proof} template={product.template} />
            </Suspense>
          ) : (
            <Suspense fallback={<PurchaseForm disabled product={product} />}>
              <ResolvedPurchaseForm event={event} product={product} proof={proof} />
            </Suspense>
          )}
          <ProductInfoDescription descriptionHtml={product.descriptionHtml} />
        </div>
      </div>
    </>
  );
}

const INVITE_MEDIA_CLASS =
  "-mx-5 aspect-square w-[calc(100%+2.5rem)] lg:col-span-6 lg:mx-0 lg:w-full";

async function ResolvedInviteImage({ event }: Pick<ProductDetailSectionProps, "event">) {
  return <InviteImage className={INVITE_MEDIA_CLASS} event={await event} />;
}

async function ResolvedPurchaseForm({ event, product, proof }: ProductDetailSectionProps) {
  const [resolvedEvent, resolvedProof] = await Promise.all([event, proof]);
  return <PurchaseForm event={resolvedEvent} product={product} proof={resolvedProof} />;
}

// A link that still carries a proof, from before the studio added designs to the cart itself, keeps its form.
async function ResolvedStudioOrder({
  product,
  proof,
  template,
}: Pick<ProductDetailSectionProps, "proof"> & ComponentProps<typeof StudioOrder>) {
  const resolvedProof = await proof;
  return resolvedProof ? (
    <PurchaseForm product={product} proof={resolvedProof} />
  ) : (
    <StudioOrder product={product} template={template} />
  );
}

export function ProductDetailSkeleton() {
  return (
    <div aria-busy="true" className="grid gap-10 lg:grid-cols-10 lg:items-start lg:gap-5">
      <div className="lg:col-span-6">
        {/* Media blocks stay static; a pulsing skeleton in the LCP slot flashes harder than an empty image canvas. */}
        <div className="grid gap-5 lg:hidden">
          <div className="-mx-5 aspect-square w-[calc(100%+2.5rem)] bg-accent" />
          <div aria-hidden="true" className="h-1.5" />
        </div>
        <div className="hidden grid-cols-2 gap-2.5 lg:grid">
          <div className="aspect-square w-full bg-accent" />
          <div className="aspect-square w-full bg-accent" />
          <div className="aspect-square w-full bg-accent" />
          <div className="aspect-square w-full bg-accent" />
        </div>
      </div>
      <div className="grid gap-10 lg:sticky lg:top-20 lg:col-span-4">
        <Skeleton className="h-9 w-3/4" />
        <Skeleton className="h-7 w-24" />
        <div className="grid gap-2.5">
          <Skeleton className="h-5 w-16" />
          <div className="flex flex-wrap gap-2">
            <Skeleton className="h-9.5 w-32 rounded-lg" />
            <Skeleton className="h-9.5 w-32 rounded-lg" />
          </div>
        </div>
        <div className="flex flex-wrap gap-2.5">
          <Skeleton className="h-12 w-38 rounded-lg" />
          <Skeleton className="h-12 min-w-40 flex-1" />
        </div>
        <div className="grid gap-4">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-5/6" />
        </div>
      </div>
    </div>
  );
}
