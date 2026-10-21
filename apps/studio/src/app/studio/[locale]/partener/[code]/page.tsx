import { Skeleton } from "@jolene/ui/skeleton";
import { Suspense } from "react";
import { PartnerJoin } from "@/components/invite/partner-join";
import { SiteHeader } from "@/components/shell/site-header";
import { getI18n } from "@/locales/server";

export async function generateMetadata() {
  const t = await getI18n();
  return { title: t("partner.title"), robots: { index: false } };
}

async function Join({ params }: { params: Promise<{ code: string }> }) {
  return <PartnerJoin code={(await params).code} />;
}

export default async function Page({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const t = await getI18n();
  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <h1 className="font-display text-5xl">{t("partner.title")}</h1>
        <div className="mt-8">
          <Suspense
            fallback={<Skeleton className="h-40 max-w-xl rounded-3xl" />}
          >
            <Join params={params} />
          </Suspense>
        </div>
      </main>
    </>
  );
}
