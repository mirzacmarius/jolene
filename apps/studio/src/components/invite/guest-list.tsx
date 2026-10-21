"use client";

import { api } from "@jolene/backend/convex/_generated/api";
import { Badge } from "@jolene/ui/badge";
import { Button } from "@jolene/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@jolene/ui/dropdown-menu";
import { Input } from "@jolene/ui/input";
import { SegmentedControl } from "@jolene/ui/segmented-control";
import { toast } from "@jolene/ui/toaster";
import { cn } from "@jolene/ui/utils";
import { useMutation } from "convex/react";
import {
  ClipboardList,
  Download,
  Ellipsis,
  Mail,
  Plus,
  Printer,
  Search,
  Users,
} from "lucide-react";
import { useState } from "react";
import { ReplyForm, useReplyLine } from "@/components/guest/reply-form";
import { errorCode } from "@/lib/convex-error";
import {
  guestListCsv,
  type Household,
  type Status,
  statusOf,
} from "@/lib/guest-list";
import { householdLink } from "@/lib/invite-links";
import { download } from "@/lib/qr";
import { useCurrentLocale, useI18n } from "@/locales/client";
import { HouseholdForm, useSideLabel } from "./household-form";
import { PasteFamilies } from "./paste-families";
import { QrPanel, SendMenu } from "./send-menu";
import type { Dashboard, Invite, ShareTexts } from "./types";

type Filter = "all" | Status;

/** Text as a search compares it: lowercase, without diacritics. */
const searchable = (text: string) =>
  text.normalize("NFKD").replace(/\p{M}/gu, "").toLowerCase();

const statusStyles: Record<Status, string> = {
  coming: "bg-primary/10 text-primary",
  "not-coming": "bg-secondary text-muted-foreground",
  waiting: "bg-gold/15 text-gold",
  "not-sent": "border border-border text-muted-foreground bg-transparent",
};

/**
 * The guest list: every family with where they are, from not sent to
 * replied, a way to send each their link, and the list as a spreadsheet or
 * on paper. Families are added one by one or pasted in.
 */
export function GuestList({
  data,
  invite,
  shareTexts,
}: {
  data: Dashboard;
  invite: Invite;
  shareTexts: ShareTexts;
}) {
  const t = useI18n();
  const locale = useCurrentLocale();
  const add = useMutation(api.households.add);
  const update = useMutation(api.households.update);
  const remove = useMutation(api.households.remove);
  const takeReply = useMutation(api.households.takeReply);
  const sendEmails = useMutation(api.invites.sendEmails);
  const replyLine = useReplyLine();
  const sideLabel = useSideLabel(data.event.occasion, data.event.fields);
  const [adding, setAdding] = useState<"one" | "paste" | null>(null);
  const [open, setOpen] = useState<{
    id: string;
    kind: "edit" | "reply" | "qr";
  } | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");

  const households = data.households;
  const trial = new Set(
    households.slice(0, data.trial).map((household) => household._id),
  );
  const locked = (household: Household) =>
    !invite.unlocked && !trial.has(household._id);
  const linkOf = (household: Household) =>
    data.base ? householdLink(data.base, invite.slug, household.code) : "";
  const messageOf = (household: Household) =>
    shareTexts[household.language ?? invite.language][data.event.occasion];
  const when = new Intl.DateTimeFormat(locale === "ro" ? "ro-RO" : "en-GB", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
  const statusLabel = (status: Status) =>
    ({
      coming: t("invite.statusComing"),
      "not-coming": t("invite.statusNotComing"),
      waiting: t("invite.statusWaiting"),
      "not-sent": t("invite.statusNotSent"),
    })[status];

  const counts = new Map<Filter, number>([["all", households.length]]);
  for (const household of households) {
    const status = statusOf(household);
    counts.set(status, (counts.get(status) ?? 0) + 1);
  }
  const words = searchable(query.trim());
  const shown = households.filter(
    (household) =>
      (filter === "all" || statusOf(household) === filter) &&
      (!words || searchable(household.name).includes(words)),
  );
  const unsentEmails = households.filter(
    (household) =>
      household.email &&
      !household.sent &&
      !household.reply &&
      !locked(household),
  );

  const detail = (household: Household) => {
    if (household.reply)
      return `${replyLine(household.reply)}${
        household.reply.by === "couple" ? ` · ${t("invite.byCouple")}` : ""
      }`;
    if (locked(household)) return t("invite.locked");
    const bounced = ["bounced", "complained", "failed"].includes(
      household.emailed?.status ?? "",
    );
    if (bounced) return t("invite.bounced");
    if (household.openedAt)
      return t("invite.opened", { date: when.format(household.openedAt) });
    if (household.sent)
      return t(`invite.sentBy.${household.sent.by}`, {
        date: when.format(household.sent.at),
      });
    return t("invite.notSent");
  };

  const exportCsv = () => {
    const csv = guestListCsv({
      households,
      columns: {
        family: t("invite.csv.family"),
        guest: t("invite.csv.guest"),
        child: t("invite.csv.child"),
        meal: t("invite.csv.meal"),
        status: t("invite.csv.status"),
        allergies: t("invite.csv.allergies"),
        message: t("invite.csv.message"),
        phone: t("invite.csv.phone"),
        email: t("invite.csv.email"),
        side: t("invite.csv.side"),
        link: t("invite.csv.link"),
        yes: t("invite.csv.yes"),
        no: t("invite.csv.no"),
      },
      // A family's own words for the tabs' "Not sent".
      statusLabel: (status) =>
        status === "not-sent" ? t("invite.notSent") : statusLabel(status),
      sideLabel,
      linkOf,
      separator: locale === "ro" ? ";" : ",",
    });
    download(
      new Blob([csv], { type: "text/csv;charset=utf-8" }),
      `invitati-${invite.slug}.csv`,
    );
  };

  const emailAll = async () => {
    try {
      const count = await sendEmails({
        inviteId: invite._id,
        householdIds: unsentEmails.map((household) => household._id),
      });
      toast(t("invite.emailed", { count }));
    } catch (error) {
      const code = errorCode(error);
      toast.error(
        code === "email-unavailable"
          ? t("invite.emailUnavailable")
          : code === "invite-locked"
            ? t("invite.lockedSend", { count: data.trial })
            : t("common.error"),
      );
    }
  };

  const filters: Filter[] = [
    "all",
    "coming",
    "not-coming",
    "waiting",
    "not-sent",
  ];

  return (
    <section className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="mr-auto font-display text-3xl">{t("invite.guests")}</h2>
        <div className="flex flex-wrap gap-2 print:hidden">
          <Button
            size="sm"
            onClick={() => setAdding(adding === "one" ? null : "one")}
          >
            <Plus aria-hidden />
            {t("invite.addFamily")}
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setAdding(adding === "paste" ? null : "paste")}
          >
            <ClipboardList aria-hidden />
            {t("invite.paste")}
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                size="icon"
                variant="ghost"
                className="size-8"
                aria-label={t("invite.export")}
                title={t("invite.export")}
              >
                <Ellipsis aria-hidden />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                disabled={households.length === 0}
                onSelect={exportCsv}
              >
                <Download aria-hidden />
                {t("invite.export")}
              </DropdownMenuItem>
              <DropdownMenuItem
                disabled={households.length === 0}
                onSelect={() => window.print()}
              >
                <Printer aria-hidden />
                {t("invite.print")}
              </DropdownMenuItem>
              <DropdownMenuItem
                disabled={unsentEmails.length === 0}
                onSelect={() => void emailAll()}
              >
                <Mail aria-hidden />
                {t("invite.emailAll", { count: unsentEmails.length })}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {adding === "one" ? (
        <div className="print:hidden">
          <HouseholdForm
            occasion={data.event.occasion}
            fields={data.event.fields}
            onCancel={() => setAdding(null)}
            onSubmit={async (household) => {
              await add({ inviteId: invite._id, households: [household] });
              setAdding(null);
            }}
          />
        </div>
      ) : adding === "paste" ? (
        <div className="print:hidden">
          <PasteFamilies inviteId={invite._id} onDone={() => setAdding(null)} />
        </div>
      ) : null}

      {!invite.unlocked && households.length > data.trial ? (
        <p className="rounded-2xl bg-gold/10 px-4 py-3 text-sm print:hidden">
          {t("invite.lockedSend", { count: data.trial })}
        </p>
      ) : null}

      {households.length === 0 ? (
        <p className="rounded-3xl border border-dashed px-6 py-10 text-center text-muted-foreground">
          {t("invite.empty")}
        </p>
      ) : (
        <>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center print:hidden">
            <div className="relative sm:w-64">
              <Search
                className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden
              />
              <Input
                type="search"
                value={query}
                placeholder={t("invite.search")}
                aria-label={t("invite.search")}
                onChange={(event) => setQuery(event.target.value)}
                className="h-9 pl-9"
              />
            </div>
            <div className="-mx-1 overflow-x-auto px-1">
              <SegmentedControl
                label={t("invite.guests")}
                value={filter}
                onValueChange={setFilter}
                options={filters.map((value) => ({
                  value,
                  label: `${value === "all" ? t("invite.all") : statusLabel(value)} ${counts.get(value) ?? 0}`,
                }))}
              />
            </div>
          </div>
          <ul className="flex flex-col divide-y divide-border/70 rounded-3xl border border-border/80 bg-card">
            {shown.map((household) => {
              const status = statusOf(household);
              const expanded = open?.id === household._id ? open.kind : null;
              const link = linkOf(household);
              return (
                <li
                  key={household._id}
                  className="flex flex-col gap-3 px-4 py-3.5 sm:px-5"
                >
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                    <div className="min-w-0 flex-1 basis-56">
                      <p className="flex flex-wrap items-center gap-x-2 font-medium">
                        <span className="min-w-0 truncate">
                          {household.name}
                        </span>
                        <span
                          className="flex items-center gap-1 text-[13px] font-normal text-muted-foreground"
                          title={t("invite.seats")}
                        >
                          <Users
                            className="size-3.5"
                            aria-label={t("invite.seats")}
                          />
                          {household.seats}
                          {household.plusOne ? " +1" : ""}
                        </span>
                        {household.source === "open" ? (
                          <Badge variant="outline">
                            {t("invite.openSource")}
                          </Badge>
                        ) : null}
                      </p>
                      <p
                        className={cn(
                          "mt-0.5 text-sm text-muted-foreground",
                          household.emailed &&
                            ["bounced", "complained", "failed"].includes(
                              household.emailed.status,
                            ) &&
                            !household.reply &&
                            "text-destructive",
                        )}
                      >
                        {detail(household)}
                        {household.side
                          ? ` · ${sideLabel(household.side)}`
                          : ""}
                      </p>
                      {household.reply?.message ? (
                        <p className="mt-1 text-sm whitespace-pre-line italic">
                          “{household.reply.message}”
                        </p>
                      ) : null}
                      {household.reply?.coming && household.reply.allergies ? (
                        <p className="mt-1 text-sm">
                          {t("guest.allergies")}: {household.reply.allergies}
                        </p>
                      ) : null}
                      {household.note ? (
                        <p className="mt-1 text-sm whitespace-pre-line text-muted-foreground">
                          {household.note}
                        </p>
                      ) : null}
                    </div>
                    {/* A family not sent to says so on the line above. */}
                    {status === "not-sent" ? null : (
                      <Badge className={statusStyles[status]}>
                        {statusLabel(status)}
                      </Badge>
                    )}
                    <div className="flex items-center gap-1 print:hidden">
                      {link ? (
                        <SendMenu
                          inviteId={invite._id}
                          household={household}
                          link={link}
                          message={messageOf(household)}
                          locked={locked(household)}
                          onQr={() =>
                            setOpen(
                              expanded === "qr"
                                ? null
                                : { id: household._id, kind: "qr" },
                            )
                          }
                        />
                      ) : null}
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="size-8"
                            aria-label={t("invite.edit")}
                            title={t("invite.edit")}
                          >
                            <Ellipsis aria-hidden />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onSelect={() =>
                              setOpen({ id: household._id, kind: "edit" })
                            }
                          >
                            {t("invite.edit")}
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onSelect={() =>
                              setOpen({ id: household._id, kind: "reply" })
                            }
                          >
                            {t("invite.takeReply")}
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-destructive"
                            onSelect={() => {
                              if (
                                window.confirm(
                                  t("invite.removeConfirm", {
                                    name: household.name,
                                  }),
                                )
                              )
                                void remove({
                                  householdId: household._id,
                                }).catch(() => toast.error(t("common.error")));
                            }}
                          >
                            {t("invite.remove")}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                  {expanded === "edit" ? (
                    <HouseholdForm
                      occasion={data.event.occasion}
                      fields={data.event.fields}
                      household={household}
                      onCancel={() => setOpen(null)}
                      onSubmit={async (changed) => {
                        await update({
                          householdId: household._id,
                          household: changed,
                        });
                        setOpen(null);
                      }}
                    />
                  ) : expanded === "reply" ? (
                    <div className="flex flex-col gap-3 rounded-2xl border border-border/80 bg-background p-4">
                      <p className="text-sm text-muted-foreground">
                        {t("invite.takeReplyLead")}
                      </p>
                      <ReplyForm
                        family={household}
                        questions={invite.questions}
                        hosts={data.hosts[locale]}
                        initial={household.reply}
                        submitLabel={t("invite.save")}
                        onCancel={() => setOpen(null)}
                        onSubmit={async (reply) => {
                          await takeReply({
                            householdId: household._id,
                            reply,
                          });
                          setOpen(null);
                        }}
                      />
                    </div>
                  ) : expanded === "qr" && link ? (
                    <QrPanel
                      name={household.name}
                      link={link}
                      file={`qr-${invite.slug}-${household.code}.png`}
                    />
                  ) : null}
                </li>
              );
            })}
          </ul>
        </>
      )}
    </section>
  );
}
