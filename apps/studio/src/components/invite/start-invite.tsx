"use client";

import { api } from "@jolene/backend/convex/_generated/api";
import type { Id } from "@jolene/backend/convex/_generated/dataModel";
import { type DesignDocument, previewFields } from "@jolene/design";
import { Button } from "@jolene/ui/button";
import { Skeleton } from "@jolene/ui/skeleton";
import { toast } from "@jolene/ui/toaster";
import { useMutation, useQuery } from "convex/react";
import { LoaderCircle } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { DesignPreview } from "@/components/design/design-preview";
import { useCurrentLocale, useI18n } from "@/locales/client";
import type { Dashboard } from "./types";

/**
 * The first step of a digital invitation: the couple picks which of the
 * event's invitation designs guests will open. Without one, they're sent
 * to design it first.
 */
export function StartInvite({ data }: { data: Dashboard }) {
  const t = useI18n();
  const locale = useCurrentLocale();
  const previews = useQuery(api.invites.previews, { eventId: data.event._id });
  const create = useMutation(api.invites.create);
  const [pending, setPending] = useState<Id<"designs"> | null>(null);
  const edited = new Intl.DateTimeFormat(locale === "ro" ? "ro-RO" : "en-GB", {
    day: "numeric",
    month: "long",
  });

  if (previews === undefined)
    return <Skeleton className="aspect-[4/5] max-w-xs rounded-3xl" />;
  if (!previews || previews.designs.length === 0)
    return (
      <div className="flex max-w-xl flex-col items-start gap-4 rounded-3xl border border-dashed p-10">
        <p className="text-muted-foreground">{t("invite.noDesign")}</p>
        <Button asChild>
          <Link href="/studio#colectii">{t("invite.browse")}</Link>
        </Button>
      </div>
    );

  const start = async (designId: Id<"designs">) => {
    setPending(designId);
    try {
      await create({ eventId: data.event._id, designId });
    } catch {
      toast.error(t("common.error"));
      setPending(null);
    }
  };

  return (
    <section className="flex flex-col gap-8">
      <div className="max-w-2xl">
        <p className="text-lg">{t("invite.lead")}</p>
        <h2 className="mt-8 font-display text-3xl">{t("invite.startTitle")}</h2>
        <p className="mt-2 text-muted-foreground">{t("invite.startLead")}</p>
      </div>
      <ul className="grid gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-4">
        {previews.designs.map((design) => {
          const document = design.document as DesignDocument;
          const about = data.designs.find((entry) => entry._id === design._id);
          return (
            <li key={design._id} className="flex flex-col gap-4">
              <div className="relative aspect-[4/5] rounded-3xl bg-secondary/70">
                <div className="absolute inset-6">
                  <DesignPreview
                    document={document}
                    fields={previewFields(
                      document.occasion,
                      document.language,
                      previews.fields,
                    )}
                    assets={previews.assets}
                    className="size-full"
                  />
                </div>
              </div>
              <p className="text-sm text-muted-foreground">
                {about?.suite ? `${about.suite[locale]} · ` : null}
                {about
                  ? t("invite.edited", { date: edited.format(about.updatedAt) })
                  : null}
              </p>
              <Button
                className="self-start"
                disabled={pending !== null}
                onClick={() => void start(design._id)}
              >
                {pending === design._id ? (
                  <LoaderCircle className="animate-spin" aria-hidden />
                ) : null}
                {pending === design._id
                  ? t("invite.starting")
                  : t("invite.start")}
              </Button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
