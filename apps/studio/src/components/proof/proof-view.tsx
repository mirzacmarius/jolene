"use client";

import { api } from "@jolene/backend/convex/_generated/api";
import { type DesignDocument, productKindLabels } from "@jolene/design";
import { Button } from "@jolene/ui/button";
import { Logo } from "@jolene/ui/logo";
import { Skeleton } from "@jolene/ui/skeleton";
import { useConvexAuth, useQuery } from "convex/react";
import { ChevronLeft } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useCurrentLocale, useI18n } from "@/locales/client";
import { type DesignData, ProofOrder } from "./proof-order";

/** The proof of the design named in the URL, for the couple who owns it. */
export function ProofView() {
  const t = useI18n();
  const { id } = useParams<{ id: string }>();
  const { isLoading } = useConvexAuth();
  const data = useQuery(api.designs.get, isLoading ? "skip" : { designId: id });
  if (data === undefined) return <ProofSkeleton />;
  if (data === null)
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-6 px-4 text-center">
        <Logo />
        <p className="max-w-sm text-muted-foreground">{t("design.notFound")}</p>
        <Button asChild variant="outline">
          <Link href="/studio">{t("common.collections")}</Link>
        </Button>
      </div>
    );
  return <Proof key={data.design._id} data={data} />;
}

/**
 * The design's sheet on a page of its own (ProofOrder): the proof beside
 * the order, to approve and put in the cart.
 */
function Proof({ data }: { data: DesignData }) {
  const t = useI18n();
  const locale = useCurrentLocale();
  const document = data.design.document as DesignDocument;
  const title = `${productKindLabels[document.kind][locale]} · ${data.template.suite.name[locale]}`;
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="flex h-14 shrink-0 items-center gap-3 border-b border-border/70 bg-background px-3 sm:px-4">
        <Button asChild variant="ghost" size="sm" className="gap-1 px-2.5">
          <Link href={`/studio/design/${data.design._id}`}>
            <ChevronLeft aria-hidden />
            <span className="hidden sm:inline">{t("proof.back")}</span>
          </Link>
        </Button>
        <h1 className="truncate font-display text-xl">{t("proof.title")}</h1>
        <span className="hidden truncate text-sm text-muted-foreground sm:inline">
          {title}
        </span>
      </header>
      <main className="flex-1 bg-[radial-gradient(80%_70%_at_50%_45%,var(--color-card),var(--color-secondary))] lg:px-8 lg:py-10">
        <div className="mx-auto max-w-[1060px] overflow-hidden bg-background lg:rounded-[28px] lg:shadow-[0_40px_80px_-40px_rgb(0_0_0/0.35)]">
          <ProofOrder data={data} />
        </div>
      </main>
    </div>
  );
}

export function ProofSkeleton() {
  return (
    <div className="flex min-h-dvh flex-col">
      <div className="h-14 border-b border-border/70" />
      <div className="flex min-h-0 flex-1">
        <div className="flex flex-1 items-center justify-center bg-secondary/60">
          <Skeleton className="aspect-[3/4] h-2/3 rounded-sm" />
        </div>
        <div className="hidden w-[380px] space-y-4 border-l border-border/70 p-5 lg:block">
          {[0, 1, 2].map((key) => (
            <Skeleton key={key} className="h-14" />
          ))}
        </div>
      </div>
    </div>
  );
}
