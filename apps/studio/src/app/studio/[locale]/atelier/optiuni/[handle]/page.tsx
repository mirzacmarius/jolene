import { Skeleton } from "@jolene/ui/skeleton";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";
import { SiteHeader } from "@/components/shell/site-header";
import { LineOptionView } from "@/components/workshop/line-option-view";
import { WorkshopGate } from "@/components/workshop/workshop-gate";
import { getI18n } from "@/locales/server";

export async function generateMetadata() {
  const t = await getI18n();
  return {
    title: `${t("workshop.lineOptions.title")} · ${t("workshop.title")}`,
    robots: { index: false },
  };
}

async function LineOption({ params }: { params: Promise<{ handle: string }> }) {
  return <LineOptionView handle={(await params).handle} />;
}

/** One of the shop's order options in the workshop, such as /studio/atelier/optiuni/culoare-plic. */
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
          href="/studio/atelier/optiuni"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" aria-hidden />
          {t("workshop.lineOptions.allOptions")}
        </Link>
        <div className="mt-6">
          <WorkshopGate>
            <Suspense fallback={<Skeleton className="h-96 rounded-3xl" />}>
              <LineOption params={params} />
            </Suspense>
          </WorkshopGate>
        </div>
      </main>
    </>
  );
}
