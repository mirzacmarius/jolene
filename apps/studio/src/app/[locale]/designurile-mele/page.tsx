import { MyDesigns } from "@/components/my-designs";
import { SiteHeader } from "@/components/shell/site-header";
import { getI18n } from "@/locales/server";

export async function generateMetadata() {
  const t = await getI18n();
  return { title: t("myDesigns.title") };
}

export default async function Page() {
  const t = await getI18n();
  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <h1 className="font-display text-5xl">{t("myDesigns.title")}</h1>
        <p className="mt-3 max-w-2xl text-muted-foreground">
          {t("myDesigns.lead")}
        </p>
        <div className="mt-10">
          <MyDesigns />
        </div>
      </main>
    </>
  );
}
