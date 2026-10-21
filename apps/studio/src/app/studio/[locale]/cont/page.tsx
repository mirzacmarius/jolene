import { Skeleton } from "@jolene/ui/skeleton";
import { Suspense } from "react";
import { AccountView } from "@/components/account/account-view";
import { SiteHeader } from "@/components/shell/site-header";
import { getI18n } from "@/locales/server";

export async function generateMetadata() {
  const t = await getI18n();
  return { title: t("account.title") };
}

export default async function Page() {
  const t = await getI18n();
  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <h1 className="font-display text-5xl">{t("account.title")}</h1>
        <div className="mt-10">
          {/* It reads ?next=, which only the browser knows. */}
          <Suspense
            fallback={<Skeleton className="h-48 max-w-md rounded-3xl" />}
          >
            <AccountView />
          </Suspense>
        </div>
      </main>
    </>
  );
}
