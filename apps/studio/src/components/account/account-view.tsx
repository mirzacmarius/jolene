"use client";

import { useAuthActions } from "@convex-dev/auth/react";
import { api } from "@jolene/backend/convex/_generated/api";
import { occasionLabels } from "@jolene/design";
import { Badge } from "@jolene/ui/badge";
import { Button } from "@jolene/ui/button";
import { Skeleton } from "@jolene/ui/skeleton";
import { useConvexAuth, useQuery } from "convex/react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";
import { useCurrentLocale, useI18n } from "@/locales/client";
import { SignInForm } from "./sign-in-form";

/** Where a sign-in may send the visitor next: only back into the studio. */
export function safeNext(next: string | null): string | null {
  return next?.startsWith("/studio/") && !next.startsWith("//") ? next : null;
}

/**
 * The visitor's account: the sign-in form until they have one, then who
 * they are and their digital invitations. A sign-in started from another
 * page (?next=) goes back there.
 */
export function AccountView() {
  const t = useI18n();
  const locale = useCurrentLocale();
  const router = useRouter();
  const next = safeNext(useSearchParams().get("next"));
  const { isLoading } = useConvexAuth();
  const { signOut } = useAuthActions();
  const me = useQuery(api.accounts.me, isLoading ? "skip" : {});
  const signedIn = me?.kind === "account";
  const events = useQuery(api.invites.mine, signedIn ? {} : "skip");

  useEffect(() => {
    if (signedIn && next) router.replace(next);
  }, [signedIn, next, router]);

  if (me === undefined)
    return <Skeleton className="h-48 max-w-md rounded-3xl" />;
  if (!signedIn) return <SignInForm />;
  return (
    <div className="flex flex-col gap-12">
      <div className="flex flex-wrap items-center gap-4">
        <p>{t("account.signedInAs", { email: me.email ?? "" })}</p>
        <Button variant="outline" size="sm" onClick={() => void signOut()}>
          {t("account.signOut")}
        </Button>
      </div>
      <section>
        <h2 className="font-display text-3xl">{t("account.invites")}</h2>
        {events === undefined ? (
          <Skeleton className="mt-6 h-20 rounded-2xl" />
        ) : events.length === 0 ? (
          <p className="mt-3 max-w-xl text-muted-foreground">
            {t("account.noEvents")}
          </p>
        ) : (
          <ul className="mt-6 flex flex-col divide-y rounded-3xl border bg-card">
            {events.map((event) => (
              <li
                key={event.eventId}
                className="flex flex-wrap items-center gap-3 px-5 py-4"
              >
                <span className="font-display text-xl">
                  {occasionLabels[event.occasion][locale]}
                  {event.hosts[locale] ? ` · ${event.hosts[locale]}` : null}
                </span>
                {event.role === "partner" ? (
                  <Badge>{t("account.partner")}</Badge>
                ) : null}
                <Button
                  asChild
                  size="sm"
                  variant={event.invite ? "outline" : "default"}
                  className="ml-auto"
                >
                  <Link href={`/studio/invitatie-digitala/${event.eventId}`}>
                    {event.invite
                      ? t("account.open")
                      : t("account.makeDigital")}
                  </Link>
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
