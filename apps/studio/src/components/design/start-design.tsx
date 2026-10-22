"use client";

import { errors } from "@jolene/backend/convex/utils/errors";
import { Button } from "@jolene/ui/button";
import { Logo } from "@jolene/ui/logo";
import { useConvexAuth } from "convex/react";
import { ConvexError } from "convex/values";
import { LoaderCircle } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useI18n } from "@/locales/client";
import { useStartDesign } from "./start-design-button";

/**
 * Starts a design from the template named in the URL and opens it in its
 * place: the shop's page for the template's product leads here (ADR 0021).
 */
export function StartDesign() {
  const t = useI18n();
  const { template } = useParams<{ template: string }>();
  const { isLoading } = useConvexAuth();
  const [failed, setFailed] = useState<"missing" | "error">();
  const { start } = useStartDesign(template, {
    replace: true,
    onFail: (error) =>
      setFailed(
        error instanceof ConvexError && error.data === errors.notFound
          ? "missing"
          : "error",
      ),
  });
  // Once the session is known: a couple who has one keeps their designs.
  const started = useRef(false);
  useEffect(() => {
    if (isLoading || started.current) return;
    started.current = true;
    start();
  });

  if (failed === undefined) return <Starting label={t("design.starting")} />;
  return (
    <main className={screenClass}>
      <Logo />
      <p className="max-w-sm text-muted-foreground" role="alert">
        {failed === "missing" ? t("design.unknownItem") : t("common.error")}
      </p>
      <div className="flex flex-wrap justify-center gap-2.5">
        {failed === "error" ? (
          <Button
            onClick={() => {
              setFailed(undefined);
              start();
            }}
          >
            {t("design.retry")}
          </Button>
        ) : null}
        <Button asChild variant="outline">
          <Link href="/studio">{t("common.collections")}</Link>
        </Button>
      </div>
    </main>
  );
}

const screenClass =
  "flex min-h-dvh flex-col items-center justify-center gap-6 px-4 text-center";

/** While the design is being made: the page's shell, and its first screen. */
export function Starting({ label }: { label: string }) {
  return (
    <main className={screenClass} aria-busy="true">
      <Logo />
      <p className="flex items-center gap-2 text-muted-foreground">
        <LoaderCircle className="size-4 animate-spin" aria-hidden />
        {label}
      </p>
    </main>
  );
}
