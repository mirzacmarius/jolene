"use client";

import { api } from "@jolene/backend/convex/_generated/api";
import {
  type DesignDocument,
  type Fields,
  type Occasion,
  occasionLabels,
  occasions,
  previewFields,
  suiteStyleLabel,
  suiteStyles,
} from "@jolene/design";
import { Badge } from "@jolene/ui/badge";
import { Button } from "@jolene/ui/button";
import { SegmentedControl } from "@jolene/ui/segmented-control";
import { Skeleton } from "@jolene/ui/skeleton";
import { useQuery } from "convex/react";
import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
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

const styleOrder: string[] = Object.keys(suiteStyles);
const styleRank = (style: string) => {
  const rank = styleOrder.indexOf(style);
  return rank === -1 ? styleOrder.length : rank;
};

/** The style words the suites carry, in the order the studio lists them. */
function stylesOf(suites: { styles: string[] }[]) {
  const present = new Set(suites.flatMap((suite) => suite.styles));
  return [...present].sort(
    (a, b) => styleRank(a) - styleRank(b) || a.localeCompare(b),
  );
}

/**
 * Jolene's published collections, each previewed by its invitation, to browse
 * by occasion and style.
 */
export function SuiteGallery() {
  const t = useI18n();
  const locale = useCurrentLocale();
  const data = useQuery(api.catalog.suites);
  const [occasion, setOccasion] = useState<Occasion | "all">("all");
  const [style, setStyle] = useState<string | null>(null);
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

  const present = occasions.filter((value) =>
    data.suites.some((suite) => suite.occasion === value),
  );
  const forOccasion = data.suites.filter(
    (suite) => occasion === "all" || suite.occasion === occasion,
  );
  const styles = stylesOf(forOccasion);
  // A style the occasion's suites don't carry shows them all.
  const chosen = style !== null && styles.includes(style) ? style : null;
  const shown = chosen
    ? forOccasion.filter((suite) => suite.styles.includes(chosen))
    : forOccasion;
  return (
    <>
      {present.length > 1 || styles.length > 1 ? (
        <div className="mb-10 flex flex-wrap items-center gap-x-6 gap-y-4">
          {present.length > 1 ? (
            <SegmentedControl
              label={t("home.occasion")}
              value={occasion}
              onValueChange={setOccasion}
              options={[
                { value: "all", label: t("home.allOccasions") },
                ...present.map((value) => ({
                  value,
                  label: occasionLabels[value][locale],
                })),
              ]}
            />
          ) : null}
          {styles.length > 1 ? (
            <fieldset className="flex flex-wrap gap-1.5">
              <legend className="sr-only">{t("home.style")}</legend>
              {styles.map((value) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={value === chosen}
                  onClick={() => setStyle(value === chosen ? null : value)}
                  className="rounded-full border border-border px-3 py-1 text-[13px] font-medium text-muted-foreground transition-colors outline-none hover:border-foreground/30 hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/40 aria-pressed:border-foreground aria-pressed:bg-foreground aria-pressed:text-background"
                >
                  {suiteStyleLabel(value, locale)}
                </button>
              ))}
            </fieldset>
          ) : null}
        </div>
      ) : null}
      <div className="grid gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
        {shown.map((suite) => (
          <SuiteCard key={suite.slug} suite={suite} assets={data.assets} />
        ))}
      </div>
    </>
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
  const href = `/studio/colectii/${suite.slug}`;
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
