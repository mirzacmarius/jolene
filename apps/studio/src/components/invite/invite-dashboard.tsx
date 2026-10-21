"use client";

import { api } from "@jolene/backend/convex/_generated/api";
import { occasionLabels } from "@jolene/design";
import { Skeleton } from "@jolene/ui/skeleton";
import { useConvexAuth, useQuery } from "convex/react";
import { SignInForm } from "@/components/account/sign-in-form";
import { useCurrentLocale, useI18n } from "@/locales/client";
import { GuestList } from "./guest-list";
import { InvitationPanel } from "./invitation-panel";
import { InviteSettings } from "./invite-settings";
import { PartnerPanel } from "./partner-panel";
import { ReplyHistory } from "./reply-history";
import { ReplySummary } from "./reply-summary";
import { StartInvite } from "./start-invite";
import type { ShareTexts } from "./types";

/**
 * The couple's page of an event's digital invitation: the card guests
 * open, the guest list with its replies and the ways to send it, and how
 * the invitation reads. A guest list is kept with an account, so a visitor
 * signs in first; their designs come with them.
 */
export function InviteDashboard({
  eventId,
  shareTexts,
}: {
  eventId: string;
  shareTexts: ShareTexts;
}) {
  const t = useI18n();
  const locale = useCurrentLocale();
  const { isLoading } = useConvexAuth();
  const data = useQuery(
    api.invites.dashboard,
    isLoading ? "skip" : { eventId },
  );

  if (data === undefined) return <Skeleton className="h-96 rounded-3xl" />;
  if (data.kind === "account-needed")
    return (
      <div className="max-w-xl">
        <SignInForm lead={t("invite.signIn")} />
      </div>
    );
  if (data.kind === "not-found")
    return <p className="text-muted-foreground">{t("invite.notFound")}</p>;

  const hosts = data.hosts[locale];
  const heading = (
    <p className="-mt-4 mb-8 text-lg text-muted-foreground print:hidden">
      {occasionLabels[data.event.occasion][locale]}
      {hosts ? ` · ${hosts}` : null}
    </p>
  );
  const invite = data.invite;
  if (!invite)
    return (
      <>
        {heading}
        <StartInvite data={data} />
      </>
    );

  return (
    <>
      {heading}
      <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_360px] lg:grid-rows-[auto_1fr] xl:grid-cols-[minmax(0,1fr)_400px]">
        <div className="flex flex-col gap-6 lg:col-start-2 lg:row-start-1 print:hidden">
          <InvitationPanel data={data} invite={invite} />
        </div>
        <div className="flex min-w-0 flex-col gap-12 lg:col-start-1 lg:row-span-2 lg:row-start-1">
          <ReplySummary households={data.households} />
          <GuestList data={data} invite={invite} shareTexts={shareTexts} />
          <ReplyHistory inviteId={invite._id} />
        </div>
        <div className="flex flex-col gap-6 self-start lg:col-start-2 lg:row-start-2 print:hidden">
          <InviteSettings data={data} invite={invite} />
          <PartnerPanel data={data} invite={invite} />
        </div>
      </div>
    </>
  );
}
