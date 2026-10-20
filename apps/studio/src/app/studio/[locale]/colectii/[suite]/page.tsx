import { Suspense } from "react";
import { SiteHeader } from "@/components/shell/site-header";
import { SuiteSkeleton, SuiteView } from "@/components/suite/suite-view";
import { getI18n } from "@/locales/server";

export async function generateMetadata() {
  const t = await getI18n();
  return { title: t("common.collections") };
}

/** The collection comes from the URL, so it's read inside Suspense. */
export default function Page() {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <Suspense fallback={<SuiteSkeleton />}>
          <SuiteView />
        </Suspense>
      </main>
    </>
  );
}
