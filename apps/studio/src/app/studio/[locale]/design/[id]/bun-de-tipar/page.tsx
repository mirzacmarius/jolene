import { Suspense } from "react";
import { ProofSkeleton, ProofView } from "@/components/proof/proof-view";
import { getI18n } from "@/locales/server";

export async function generateMetadata() {
  const t = await getI18n();
  return { title: t("proof.title") };
}

/** The design comes from the URL, so it's read inside Suspense. */
export default function Page() {
  return (
    <Suspense fallback={<ProofSkeleton />}>
      <ProofView />
    </Suspense>
  );
}
