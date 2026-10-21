"use client";

import { api } from "@jolene/backend/convex/_generated/api";
import type { Id } from "@jolene/backend/convex/_generated/dataModel";
import { Button } from "@jolene/ui/button";
import { toast } from "@jolene/ui/toaster";
import { useMutation, useQuery } from "convex/react";
import { Check, Copy } from "lucide-react";
import { useRouter } from "next/navigation";
import { errorCode } from "@/lib/convex-error";
import { useI18n } from "@/locales/client";
import { useCopy } from "./invite-settings";
import type { Dashboard, Invite } from "./types";

/**
 * Who manages the invitation, and the link that asks a partner to join:
 * they sign in with their own email and see the guest list too.
 */
export function PartnerPanel({
  data,
  invite,
}: {
  data: Dashboard;
  invite: Invite;
}) {
  const t = useI18n();
  const router = useRouter();
  const me = useQuery(api.accounts.me);
  const setLink = useMutation(api.invites.setPartnerLink);
  const remove = useMutation(api.partners.remove);
  const { copied, copy } = useCopy();
  const link = invite.partnerCode
    ? `${window.location.origin}/studio/partener/${invite.partnerCode}`
    : null;

  const changeLink = (on: boolean) =>
    setLink({ inviteId: invite._id, on }).catch((error) =>
      toast.error(
        errorCode(error) === "too-many"
          ? t("account.tooMany")
          : t("common.error"),
      ),
    );

  const removePerson = async (userId: Id<"users">, self: boolean) => {
    if (self && !window.confirm(t("invite.leaveConfirm"))) return;
    try {
      await remove({ eventId: data.event._id, userId });
      if (self) router.push("/studio/cont");
    } catch {
      toast.error(t("common.error"));
    }
  };

  return (
    <section className="flex flex-col gap-4 rounded-3xl border border-border/80 bg-card p-5 sm:p-6">
      <h2 className="font-display text-2xl">{t("invite.together")}</h2>
      <p className="text-sm text-muted-foreground">
        {t("invite.togetherLead")}
      </p>
      <div className="flex flex-col gap-2">
        <p className="text-sm font-medium">{t("invite.managedBy")}</p>
        <ul className="flex flex-col gap-2">
          {data.people.map((person) => {
            const self = me?.kind === "account" && me.email === person.email;
            return (
              <li
                key={person.userId}
                className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm"
              >
                <span className="min-w-0 truncate">{person.email}</span>
                <span className="text-muted-foreground">
                  {person.role === "owner"
                    ? t("invite.owner")
                    : t("invite.partner")}
                  {self ? ` · ${t("invite.you")}` : ""}
                </span>
                {person.role === "partner" &&
                (data.role === "owner" || self) ? (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="ml-auto h-7"
                    onClick={() => void removePerson(person.userId, self)}
                  >
                    {self ? t("invite.leave") : t("invite.remove")}
                  </Button>
                ) : null}
              </li>
            );
          })}
        </ul>
      </div>
      {link ? (
        <div className="flex flex-col gap-2">
          <code className="truncate rounded-lg bg-secondary px-3 py-2 text-[13px]">
            {link}
          </code>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={() => void copy(link)}>
              {copied === link ? <Check aria-hidden /> : <Copy aria-hidden />}
              {copied === link ? t("invite.copied") : t("invite.copy")}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => void changeLink(true)}
            >
              {t("invite.newLink")}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => void changeLink(false)}
            >
              {t("invite.linkOff")}
            </Button>
          </div>
        </div>
      ) : (
        <Button
          size="sm"
          variant="outline"
          className="self-start"
          onClick={() => void changeLink(true)}
        >
          {t("invite.makeLink")}
        </Button>
      )}
    </section>
  );
}
