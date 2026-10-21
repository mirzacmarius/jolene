import { SiteHeader } from "@/components/shell/site-header";
import { LineOptionList } from "@/components/workshop/line-option-list";
import { WorkshopGate } from "@/components/workshop/workshop-gate";
import { WorkshopNav } from "@/components/workshop/workshop-nav";
import { getI18n } from "@/locales/server";

export async function generateMetadata() {
  const t = await getI18n();
  return {
    title: `${t("workshop.lineOptions.title")} · ${t("workshop.title")}`,
    robots: { index: false },
  };
}

/** The shop's order options, for the workshop to change. */
export default async function Page() {
  const t = await getI18n();
  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
        <WorkshopNav current="lineOptions" />
        <h1 className="mt-6 font-display text-5xl">
          {t("workshop.lineOptions.title")}
        </h1>
        <p className="mt-3 max-w-2xl text-muted-foreground">
          {t("workshop.lineOptions.lead")}
        </p>
        <div className="mt-8">
          <WorkshopGate>
            <LineOptionList />
          </WorkshopGate>
        </div>
      </main>
    </>
  );
}
