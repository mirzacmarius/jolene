import { SiteHeader } from "@/components/shell/site-header";
import { OrderList } from "@/components/workshop/order-list";
import { WorkshopGate } from "@/components/workshop/workshop-gate";
import { WorkshopNav } from "@/components/workshop/workshop-nav";
import { getI18n } from "@/locales/server";

export async function generateMetadata() {
  const t = await getI18n();
  return { title: t("workshop.title"), robots: { index: false } };
}

/** Jolene's workshop: the orders couples paid for, for the team's accounts. */
export default async function Page() {
  const t = await getI18n();
  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
        <WorkshopNav current="orders" />
        <h1 className="mt-6 font-display text-5xl">{t("workshop.title")}</h1>
        <p className="mt-3 max-w-2xl text-muted-foreground">
          {t("workshop.lead")}
        </p>
        <div className="mt-8">
          <WorkshopGate>
            <OrderList />
          </WorkshopGate>
        </div>
      </main>
    </>
  );
}
