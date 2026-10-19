"use client";

import { api } from "@jolene/backend/convex/_generated/api";
import {
  type DesignDocument,
  type Fields,
  type Occasion,
  previewFields,
  suiteStyleLabel,
} from "@jolene/design";
import { Badge } from "@jolene/ui/badge";
import { Button } from "@jolene/ui/button";
import { Skeleton } from "@jolene/ui/skeleton";
import { useQuery } from "convex/react";
import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { useMemo } from "react";
import { useCurrentLocale, useI18n } from "@/locales/client";
import { type AssetLink, DesignPreview } from "../design/design-preview";
import { StartDesignButton } from "../design/start-design-button";

interface SuiteSummary {
  slug: string;
  name: { ro: string; en: string };
  description: { ro: string; en: string };
  occasion: Occasion;
  styles: string[];
  sampleFields: Fields;
  lead: { slug: string; document: unknown } | null;
}

/** Jolene's published collections, each previewed by its invitation. */
export function SuiteGallery() {
  const t = useI18n();
  const data = useQuery(api.catalog.suites);
  if (data === undefined)
    return (
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {[0, 1, 2].map((key) => (
          <Skeleton key={key} className="aspect-[4/5] rounded-3xl" />
        ))}
      </div>
    );
  if (data.suites.length === 0)
    return (
      <p className="rounded-3xl border border-dashed p-10 text-center text-muted-foreground">
        {t("home.empty")}
      </p>
    );
  return (
    <div className="grid gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
      {data.suites.map((suite) => (
        <SuiteCard key={suite.slug} suite={suite} assets={data.assets} />
      ))}
    </div>
  );
}

function SuiteCard({
  suite,
  assets,
}: {
  suite: SuiteSummary;
  assets: AssetLink[];
}) {
  const t = useI18n();
  const locale = useCurrentLocale();
  const href = `/colectii/${suite.slug}`;
  const lead = suite.lead?.document as DesignDocument | undefined;
  const fields = useMemo(
    () =>
      previewFields(suite.occasion, lead?.language ?? "ro", suite.sampleFields),
    [suite.occasion, lead?.language, suite.sampleFields],
  );
  return (
    <article className="group flex flex-col">
      <Link
        href={href}
        className="relative block aspect-[4/5] overflow-hidden rounded-3xl bg-secondary/70 outline-none ring-offset-4 ring-offset-background transition-colors hover:bg-secondary focus-visible:ring-[3px] focus-visible:ring-ring/50"
      >
        {lead ? (
          <div className="absolute inset-8">
            <DesignPreview
              document={lead}
              fields={fields}
              assets={assets}
              title={suite.name[locale]}
              className="size-full transition-transform duration-500 group-hover:-translate-y-1 group-hover:scale-[1.02]"
            />
          </div>
        ) : null}
      </Link>
      <div className="flex flex-1 flex-col px-1 pt-5">
        <h3 className="font-display text-3xl leading-tight">
          <Link href={href} className="hover:underline underline-offset-4">
            {suite.name[locale]}
          </Link>
        </h3>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          {suite.description[locale]}
        </p>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {suite.styles.map((style) => (
            <Badge key={style}>{suiteStyleLabel(style, locale)}</Badge>
          ))}
        </div>
        <div className="mt-5 flex flex-wrap items-center gap-2">
          {suite.lead ? (
            <StartDesignButton template={suite.lead.slug}>
              {t("home.personalise")}
            </StartDesignButton>
          ) : null}
          <Button asChild variant="ghost">
            <Link href={href}>
              {t("home.viewCollection")}
              <ArrowRight aria-hidden />
            </Link>
          </Button>
        </div>
      </div>
    </article>
  );
}
