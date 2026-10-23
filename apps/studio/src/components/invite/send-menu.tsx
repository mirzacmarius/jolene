"use client";

import { api } from "@jolene/backend/convex/_generated/api";
import type { Id } from "@jolene/backend/convex/_generated/dataModel";
import { Button } from "@jolene/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@jolene/ui/dropdown-menu";
import { toast } from "@jolene/ui/toaster";
import { useMutation } from "convex/react";
import {
  ChevronDown,
  Copy,
  Download,
  ExternalLink,
  Mail,
  MessageCircle,
  MessageSquareText,
  QrCode,
} from "lucide-react";
import { errorCode } from "@/lib/convex-error";
import type { Household } from "@/lib/guest-list";
import { fill, smsLink, whatsappLink } from "@/lib/invite-links";
import { download, qrPath, qrPng } from "@/lib/qr";
import { useI18n } from "@/locales/client";

/**
 * Sends a family their link from the couple's own phone or email: WhatsApp
 * or a text message with the message written in, an email from Jolene in
 * the couple's names, the link to paste anywhere, or its QR code.
 */
export function SendMenu({
  inviteId,
  household,
  link,
  message,
  locked,
  onQr,
}: {
  inviteId: Id<"invites">;
  household: Household;
  link: string;
  /** The message the link goes with, in the family's language. */
  message: string;
  /** Not one of the families who can open it before it's unlocked. */
  locked: boolean;
  onQr: () => void;
}) {
  const t = useI18n();
  const markSent = useMutation(api.households.markSent);
  const sendEmails = useMutation(api.invites.sendEmails);
  const text = fill(message, { name: household.name, link });
  const sent = (by: "whatsapp" | "sms" | "link") =>
    void markSent({ householdId: household._id, by }).catch(() => {});

  const email = async () => {
    try {
      await sendEmails({ inviteId, householdIds: [household._id] });
      toast(t("invite.emailed", { count: 1 }));
    } catch (error) {
      const code = errorCode(error);
      toast.error(
        code === "email-unavailable"
          ? t("invite.emailUnavailable")
          : code === "trial-emails"
            ? t("invite.trialEmails")
            : code === "too-many"
              ? t("account.tooMany")
              : t("common.error"),
      );
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size="sm" variant="outline">
          {t("invite.send")}
          <ChevronDown aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        {locked ? (
          <>
            <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
              {t("invite.locked")}
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
          </>
        ) : null}
        <DropdownMenuItem asChild disabled={locked}>
          <a
            href={whatsappLink(text, household.phone)}
            target="_blank"
            rel="noopener"
            onClick={() => sent("whatsapp")}
          >
            <MessageCircle aria-hidden />
            {t("invite.whatsapp")}
          </a>
        </DropdownMenuItem>
        <DropdownMenuItem asChild disabled={locked}>
          <a href={smsLink(text, household.phone)} onClick={() => sent("sms")}>
            <MessageSquareText aria-hidden />
            {t("invite.sms")}
          </a>
        </DropdownMenuItem>
        <DropdownMenuItem
          disabled={locked || !household.email}
          onSelect={() => void email()}
        >
          <Mail aria-hidden />
          {t("invite.sendEmail")}
          {household.email ? null : (
            <span className="ml-auto text-xs text-muted-foreground">—</span>
          )}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          disabled={locked}
          onSelect={() =>
            void navigator.clipboard.writeText(link).then(() => {
              sent("link");
              toast(t("invite.copied"));
            })
          }
        >
          <Copy aria-hidden />
          {t("invite.copyLink")}
        </DropdownMenuItem>
        <DropdownMenuItem disabled={locked} onSelect={onQr}>
          <QrCode aria-hidden />
          {t("invite.qr")}
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <a href={link} target="_blank" rel="noopener">
            <ExternalLink aria-hidden />
            {t("invite.openInvite")}
          </a>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** A family's link as a QR code, to show on a screen or put on paper. */
export function QrPanel({
  name,
  link,
  file,
}: {
  name: string;
  link: string;
  /** The PNG's name when it's downloaded. */
  file: string;
}) {
  const t = useI18n();
  const { size, path } = qrPath(link);
  return (
    <div className="flex flex-wrap items-center gap-5 rounded-2xl border border-border/80 bg-background p-4">
      <svg
        viewBox={`0 0 ${size} ${size}`}
        className="size-40 rounded-lg bg-white"
        role="img"
        aria-label={t("invite.qr")}
        shapeRendering="crispEdges"
      >
        <path d={path} fill="#000" />
      </svg>
      <div className="flex max-w-xs flex-col items-start gap-3">
        <p className="text-sm text-muted-foreground">
          {t("invite.qrLead", { name })}
        </p>
        <Button
          size="sm"
          variant="outline"
          onClick={() =>
            void qrPng(link)
              .then((png) => download(png, file))
              .catch(() => toast.error(t("common.error")))
          }
        >
          <Download aria-hidden />
          {t("invite.download")}
        </Button>
      </div>
    </div>
  );
}
