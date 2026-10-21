import { SiteHeader } from "@/components/shell/site-header";
import { WorkshopGate } from "@/components/workshop/workshop-gate";
import { WorkshopNav } from "@/components/workshop/workshop-nav";
import { WorkshopSettings } from "@/components/workshop/workshop-settings";
import { getI18n } from "@/locales/server";

export async function generateMetadata() {
  const t = await getI18n();
  return {
    title: `${t("workshop.settings.title")} · ${t("workshop.title")}`,
    robots: { index: false },
  };
}

/** What the workshop sets for every couple, at /studio/atelier/setari. */
export default async function Page() {
  const t = await getI18n();
  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
        <WorkshopNav current="settings" />
        <h1 className="mt-6 font-display text-5xl">
          {t("workshop.settings.title")}
        </h1>
        <p className="mt-3 max-w-2xl text-muted-foreground">
          {t("workshop.settings.lead")}
        </p>
        <div className="mt-8">
          <WorkshopGate>
            <WorkshopSettings />
          </WorkshopGate>
        </div>
      </main>
    </>
  );
}
