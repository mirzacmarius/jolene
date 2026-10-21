import { Skeleton } from "@jolene/ui/skeleton";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";
import { InviteDashboard } from "@/components/invite/invite-dashboard";
import { SiteHeader } from "@/components/shell/site-header";
import { dictionaries } from "@/locales/dictionaries";
import { getI18n } from "@/locales/server";

export async function generateMetadata() {
  const t = await getI18n();
  return { title: t("invite.title"), robots: { index: false } };
}

/** The message a family's link goes with, in each language guests read. */
const shareTexts = {
  ro: dictionaries.ro.guest.share,
  en: dictionaries.en.guest.share,
};

async function Dashboard({ params }: { params: Promise<{ event: string }> }) {
  return (
    <InviteDashboard eventId={(await params).event} shareTexts={shareTexts} />
  );
}

export default async function Page({
  params,
}: {
  params: Promise<{ event: string }>;
}) {
  const t = await getI18n();
  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <Link
          href="/studio/designurile-mele"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground print:hidden"
        >
          <ArrowLeft className="size-4" aria-hidden />
          {t("invite.back")}
        </Link>
        <h1 className="mt-4 font-display text-5xl">{t("invite.title")}</h1>
        <div className="mt-8">
          <Suspense fallback={<Skeleton className="h-96 rounded-3xl" />}>
            <Dashboard params={params} />
          </Suspense>
        </div>
      </main>
    </>
  );
}
