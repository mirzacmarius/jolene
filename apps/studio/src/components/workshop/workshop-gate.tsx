"use client";

import { useAuthActions } from "@convex-dev/auth/react";
import { api } from "@jolene/backend/convex/_generated/api";
import { Button } from "@jolene/ui/button";
import { Skeleton } from "@jolene/ui/skeleton";
import { useConvexAuth, useQuery } from "convex/react";
import type { ReactNode } from "react";
import { SignInForm } from "@/components/account/sign-in-form";
import { GoogleSignIn } from "@/components/workshop/google-sign-in";
import { useI18n } from "@/locales/client";

/**
 * The workshop's pages, for the accounts on its list (WORKSHOP_EMAILS):
 * anyone else signs in, with Google once the deployment has Google's client
 * and with a code sent to their email until then, or is told their account
 * isn't on it.
 */
export function WorkshopGate({ children }: { children: ReactNode }) {
  const t = useI18n();
  const { isLoading } = useConvexAuth();
  const { signOut } = useAuthActions();
  const access = useQuery(api.workshop.access, isLoading ? "skip" : {});
  if (access === undefined)
    return <Skeleton className="h-48 max-w-md rounded-3xl" />;
  if (!access.signedIn)
    return access.google ? (
      <GoogleSignIn
        lead={t("workshop.googleLead")}
        origins={access.google.origins}
      />
    ) : (
      <SignInForm lead={t("workshop.signInLead")} />
    );
  // An address on the list that signed in with a code before the workshop
  // went over to Google.
  if (!access.allowed && access.listed && access.google)
    return (
      <GoogleSignIn
        lead={t("workshop.googleNow", { email: access.email })}
        origins={access.google.origins}
      />
    );
  if (!access.allowed)
    return (
      <div className="flex max-w-xl flex-col items-start gap-4 rounded-3xl border border-dashed p-10">
        <p>{t("workshop.notAllowed", { email: access.email })}</p>
        <Button variant="outline" onClick={() => void signOut()}>
          {t("account.signOut")}
        </Button>
      </div>
    );
  return (
    <>
      <p className="flex flex-wrap items-center gap-x-3 text-sm text-muted-foreground">
        {t("account.signedInAs", { email: access.email })}
        <Button
          variant="link"
          size="sm"
          className="h-auto p-0"
          onClick={() => void signOut()}
        >
          {t("account.signOut")}
        </Button>
      </p>
      <div className="mt-8">{children}</div>
    </>
  );
}
