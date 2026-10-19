"use client";

import { api } from "@jolene/backend/convex/_generated/api";
import {
  type DesignDocument,
  previewFields,
  productKindLabels,
} from "@jolene/design";
import { Button } from "@jolene/ui/button";
import { Skeleton } from "@jolene/ui/skeleton";
import { useConvexAuth, useQuery } from "convex/react";
import Link from "next/link";
import { useCurrentLocale, useI18n } from "@/locales/client";
import { DesignPreview } from "./design/design-preview";

/** The visitor's designs, newest first, each opening in the workspace. */
export function MyDesigns() {
  const t = useI18n();
  const locale = useCurrentLocale();
  const { isLoading } = useConvexAuth();
  const data = useQuery(api.designs.mine, isLoading ? "skip" : {});
  if (data === undefined)
    return (
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {[0, 1, 2, 3].map((key) => (
          <Skeleton key={key} className="aspect-[4/5] rounded-3xl" />
        ))}
      </div>
    );
  if (data.designs.length === 0)
    return (
      <div className="flex flex-col items-start gap-4 rounded-3xl border border-dashed p-10">
        <p className="text-muted-foreground">{t("myDesigns.empty")}</p>
        <Button asChild>
          <Link href="/studio#colectii">{t("home.browse")}</Link>
        </Button>
      </div>
    );
  const events = new Map(data.events.map((event) => [event._id, event]));
  const suites = new Map(
    data.templates.map((template) => [template._id, template.suite]),
  );
  const edited = new Intl.DateTimeFormat(locale === "ro" ? "ro-RO" : "en-GB", {
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  });
  return (
    <ul className="grid gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-4">
      {data.designs.map((design) => {
        const document = design.document as DesignDocument;
        const event = events.get(design.eventId);
        const suite = suites.get(design.templateId);
        return (
          <li key={design._id}>
            <Link href={`/studio/design/${design._id}`} className="group block">
              <div className="relative aspect-[4/5] rounded-3xl bg-secondary/70 transition-colors group-hover:bg-secondary">
                <div className="absolute inset-6">
                  <DesignPreview
                    document={document}
                    fields={previewFields(
                      document.occasion,
                      document.language,
                      event?.fields ?? {},
                    )}
                    assets={data.assets}
                    className="size-full"
                  />
                </div>
              </div>
              <h2 className="mt-4 font-display text-2xl group-hover:underline group-hover:underline-offset-4">
                {productKindLabels[document.kind][locale]}
              </h2>
              <p className="text-sm text-muted-foreground">
                {suite ? `${suite.name[locale]} · ` : null}
                {t("myDesigns.edited", {
                  date: edited.format(design.updatedAt),
                })}
              </p>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
