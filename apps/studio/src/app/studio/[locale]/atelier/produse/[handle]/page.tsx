import { Skeleton } from "@jolene/ui/skeleton";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";
import { SiteHeader } from "@/components/shell/site-header";
import { ProductView } from "@/components/workshop/product-view";
import { WorkshopGate } from "@/components/workshop/workshop-gate";
import { getI18n } from "@/locales/server";

export async function generateMetadata() {
  const t = await getI18n();
  return {
    title: `${t("workshop.catalog.title")} · ${t("workshop.title")}`,
    robots: { index: false },
  };
}

async function Product({ params }: { params: Promise<{ handle: string }> }) {
  return <ProductView handle={(await params).handle} />;
}

/** One of the shop's products in the workshop, such as /studio/atelier/produse/18207. */
export default async function Page({
  params,
}: {
  params: Promise<{ handle: string }>;
}) {
  const t = await getI18n();
  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
        <Link
          href="/studio/atelier/produse"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" aria-hidden />
          {t("workshop.catalog.allProducts")}
        </Link>
        <div className="mt-6">
          <WorkshopGate>
            <Suspense fallback={<Skeleton className="h-96 rounded-3xl" />}>
              <Product params={params} />
            </Suspense>
          </WorkshopGate>
        </div>
      </main>
    </>
  );
}
