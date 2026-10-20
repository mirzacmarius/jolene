"use client";

import { api } from "@jolene/backend/convex/_generated/api";
import {
  type DesignDocument,
  previewFields,
  productKindLabels,
  suiteStyleLabel,
} from "@jolene/design";
import { Badge } from "@jolene/ui/badge";
import { Skeleton } from "@jolene/ui/skeleton";
import { useQuery } from "convex/react";
import { ChevronLeft } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useMemo } from "react";
import { useCurrentLocale, useI18n } from "@/locales/client";
import { DesignPreview } from "../design/design-preview";
import { StartDesignButton } from "../design/start-design-button";
import { useEventFields } from "../design/use-event-fields";

/**
 * One collection: its invitation large, then every piece it holds, with the
 * couple's details once they've given them.
 */
export function SuiteView() {
  const t = useI18n();
  const locale = useCurrentLocale();
  const { suite: slug } = useParams<{ suite: string }>();
  const data = useQuery(api.catalog.suite, { slug });
  const own = useEventFields();
  const lead = data?.templates[0];
  const leadDocument = lead?.document as DesignDocument | undefined;
  const fields = useMemo(
    () =>
      data
        ? previewFields(data.suite.occasion, leadDocument?.language ?? "ro", {
            ...data.suite.sampleFields,
            ...own[data.suite.occasion],
          })
        : {},
    [data, leadDocument?.language, own],
  );

  if (data === undefined) return <SuiteSkeleton />;
  if (data === null)
    return (
      <p className="py-24 text-center text-muted-foreground">
        {t("suite.notFound")}
      </p>
    );

  const { suite, templates, assets } = data;
  return (
    <>
      <Link
        href="/studio#colectii"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ChevronLeft className="size-4" aria-hidden />
        {t("suite.back")}
      </Link>
      <div className="mt-6 grid items-center gap-12 lg:grid-cols-[1fr_1.1fr]">
        <div>
          <h1 className="font-display text-5xl font-medium sm:text-6xl">
            {suite.name[locale]}
          </h1>
          <p className="mt-4 max-w-xl text-lg leading-relaxed text-muted-foreground">
            {suite.description[locale]}
          </p>
          <div className="mt-5 flex flex-wrap gap-1.5">
            {suite.styles.map((style) => (
              <Badge key={style}>{suiteStyleLabel(style, locale)}</Badge>
            ))}
          </div>
          {lead ? (
            <StartDesignButton template={lead.slug} size="lg" className="mt-8">
              {t("home.personalise")}
            </StartDesignButton>
          ) : null}
        </div>
        {leadDocument ? (
          <div className="relative aspect-[5/6] w-full rounded-[2rem] bg-secondary/70">
            <div className="absolute inset-8 sm:inset-12">
              <DesignPreview
                document={leadDocument}
                fields={fields}
                assets={assets}
                title={suite.name[locale]}
                className="size-full"
              />
            </div>
          </div>
        ) : null}
      </div>

      <h2 className="mt-20 font-display text-3xl">{t("suite.items")}</h2>
      <ul className="mt-6 grid gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-4">
        {templates.map((template) => {
          const document = template.document as DesignDocument;
          const piece = document.pieces[0];
          return (
            <li key={template.slug} className="flex flex-col">
              <div className="relative aspect-square rounded-3xl bg-secondary/70">
                <div className="absolute inset-6">
                  <DesignPreview
                    document={document}
                    fields={fields}
                    assets={assets}
                    title={productKindLabels[template.kind][locale]}
                    className="size-full"
                  />
                </div>
              </div>
              <h3 className="mt-4 font-display text-2xl">
                {productKindLabels[template.kind][locale]}
              </h3>
              {piece ? (
                <p className="text-sm text-muted-foreground">
                  {t("suite.size", {
                    width: piece.width,
                    height: piece.height,
                  })}
                </p>
              ) : null}
              <StartDesignButton
                template={template.slug}
                variant="outline"
                size="sm"
                className="mt-3 self-start"
              >
                {t("home.personalise")}
              </StartDesignButton>
            </li>
          );
        })}
      </ul>
    </>
  );
}

export function SuiteSkeleton() {
  return (
    <div className="grid gap-12 lg:grid-cols-[1fr_1.1fr]">
      <div className="space-y-4 pt-10">
        <Skeleton className="h-14 w-2/3" />
        <Skeleton className="h-20 w-full" />
      </div>
      <Skeleton className="aspect-[5/6] rounded-[2rem]" />
    </div>
  );
}
