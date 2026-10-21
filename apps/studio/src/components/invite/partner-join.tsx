"use client";

import { api } from "@jolene/backend/convex/_generated/api";
import { Button } from "@jolene/ui/button";
import { Skeleton } from "@jolene/ui/skeleton";
import { toast } from "@jolene/ui/toaster";
import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { LoaderCircle } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { SignInForm } from "@/components/account/sign-in-form";
import { useCurrentLocale, useI18n } from "@/locales/client";

/**
 * Where a partner's link leads: who asked them, then a sign-in with their
 * own email and a button that joins them to the event.
 */
export function PartnerJoin({ code }: { code: string }) {
  const t = useI18n();
  const locale = useCurrentLocale();
  const router = useRouter();
  const { isLoading } = useConvexAuth();
  const preview = useQuery(
    api.partners.preview,
    isLoading ? "skip" : { code, language: locale },
  );
  const join = useMutation(api.partners.join);
  const [pending, setPending] = useState(false);

  if (preview === undefined)
    return <Skeleton className="h-40 max-w-xl rounded-3xl" />;
  if (preview === null)
    return <p className="text-muted-foreground">{t("partner.expired")}</p>;
  const dashboard = `/studio/invitatie-digitala/${preview.eventId}`;
  return (
    <div className="flex max-w-xl flex-col gap-8">
      <p className="text-lg">
        {preview.hosts
          ? t("partner.lead", { hosts: preview.hosts })
          : t("partner.leadUnnamed")}
      </p>
      {preview.viewer === "account-needed" ? (
        <SignInForm lead={t("partner.signIn")} />
      ) : preview.viewer === "can-join" ? (
        <Button
          className="self-start"
          disabled={pending}
          onClick={async () => {
            setPending(true);
            try {
              router.push(`/studio/invitatie-digitala/${await join({ code })}`);
            } catch {
              setPending(false);
              toast.error(t("common.error"));
            }
          }}
        >
          {pending ? (
            <LoaderCircle className="animate-spin" aria-hidden />
          ) : null}
          {pending ? t("partner.joining") : t("partner.join")}
        </Button>
      ) : (
        <div className="flex flex-col items-start gap-3">
          <p className="text-muted-foreground">{t("partner.already")}</p>
          <Button asChild>
            <Link href={dashboard}>{t("partner.open")}</Link>
          </Button>
        </div>
      )}
    </div>
  );
}
