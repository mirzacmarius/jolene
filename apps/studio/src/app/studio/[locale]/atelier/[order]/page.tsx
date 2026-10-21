import { Skeleton } from "@jolene/ui/skeleton";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";
import { SiteHeader } from "@/components/shell/site-header";
import { OrderView } from "@/components/workshop/order-view";
import { WorkshopGate } from "@/components/workshop/workshop-gate";
import { getI18n } from "@/locales/server";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ order: string }>;
}) {
  const t = await getI18n();
  const { order } = await params;
  return {
    title: `${order} · ${t("workshop.title")}`,
    robots: { index: false },
  };
}

async function Name({ params }: { params: Promise<{ order: string }> }) {
  return (await params).order;
}

async function Order({ params }: { params: Promise<{ order: string }> }) {
  return <OrderView name={(await params).order} />;
}

/** One order in the workshop, such as /studio/atelier/J1001. */
export default async function Page({
  params,
}: {
  params: Promise<{ order: string }>;
}) {
  const t = await getI18n();
  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
        <Link
          href="/studio/atelier"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" aria-hidden />
          {t("workshop.allOrders")}
        </Link>
        <h1 className="mt-4 font-display text-5xl">
          <Suspense fallback={t("workshop.title")}>
            <Name params={params} />
          </Suspense>
        </h1>
        <div className="mt-6">
          <WorkshopGate>
            <Suspense fallback={<Skeleton className="h-96 rounded-3xl" />}>
              <Order params={params} />
            </Suspense>
          </WorkshopGate>
        </div>
      </main>
    </>
  );
}
