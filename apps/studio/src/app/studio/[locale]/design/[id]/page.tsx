import { Suspense } from "react";
import { Workspace, WorkspaceSkeleton } from "@/components/workspace/workspace";
import { getI18n } from "@/locales/server";

export async function generateMetadata() {
  const t = await getI18n();
  return { title: t("common.appName") };
}

/** The design comes from the URL, so it's read inside Suspense. */
export default function Page() {
  return (
    <Suspense fallback={<WorkspaceSkeleton />}>
      <Workspace />
    </Suspense>
  );
}
