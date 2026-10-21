"use client";

import { api } from "@jolene/backend/convex/_generated/api";
import type { Id } from "@jolene/backend/convex/_generated/dataModel";
import { Skeleton } from "@jolene/ui/skeleton";
import { useQuery } from "convex/react";
import { useReplyLine } from "@/components/guest/reply-form";
import { useCurrentLocale, useI18n } from "@/locales/client";

/** The latest replies as they came, a family's changes included. */
export function ReplyHistory({ inviteId }: { inviteId: Id<"invites"> }) {
  const t = useI18n();
  const locale = useCurrentLocale();
  const history = useQuery(api.invites.history, { inviteId });
  const replyLine = useReplyLine();
  const when = new Intl.DateTimeFormat(locale === "ro" ? "ro-RO" : "en-GB", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
  return (
    <section className="flex flex-col gap-4 print:hidden">
      <h2 className="font-display text-3xl">{t("invite.history")}</h2>
      {history === undefined ? (
        <Skeleton className="h-24 rounded-2xl" />
      ) : history.length === 0 ? (
        <p className="text-muted-foreground">{t("invite.noHistory")}</p>
      ) : (
        <ol className="flex flex-col divide-y divide-border/70">
          {history.map((entry) => (
            <li key={entry._id} className="flex flex-col gap-1 py-3">
              <p className="text-sm text-muted-foreground">
                {t("invite.replied", {
                  name: entry.household,
                  date: when.format(entry.reply.at),
                })}
                {entry.reply.by === "couple"
                  ? ` · ${t("invite.byCouple")}`
                  : null}
              </p>
              <p>{replyLine(entry.reply)}</p>
              {entry.reply.message ? (
                <p className="text-sm whitespace-pre-line text-muted-foreground italic">
                  “{entry.reply.message}”
                </p>
              ) : null}
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
