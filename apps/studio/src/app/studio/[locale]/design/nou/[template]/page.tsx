import { Suspense } from "react";
import { StartDesign, Starting } from "@/components/design/start-design";
import { getI18n } from "@/locales/server";

export async function generateMetadata() {
  const t = await getI18n();
  return { title: t("design.starting"), robots: { index: false } };
}

/** The template comes from the URL, so it's read inside Suspense. */
export default async function Page() {
  const t = await getI18n();
  return (
    <Suspense fallback={<Starting label={t("design.starting")} />}>
      <StartDesign />
    </Suspense>
  );
}
