"use client";

import { Logo } from "@jolene/ui/logo";
import Link from "next/link";
import { useI18n } from "@/locales/client";

/** An address nothing answers: one calm column with the way back. */
export default function NotFound() {
  const t = useI18n();
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-6 px-4 text-center">
      <Logo />
      <p className="max-w-sm text-muted-foreground">{t("common.notFound")}</p>
      <Link
        href="/studio"
        className="text-sm font-medium underline underline-offset-4"
      >
        {t("common.collections")}
      </Link>
    </main>
  );
}
