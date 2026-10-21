"use client";

import { useAuthActions } from "@convex-dev/auth/react";
import { api } from "@jolene/backend/convex/_generated/api";
import { Button } from "@jolene/ui/button";
import { Skeleton } from "@jolene/ui/skeleton";
import { useConvexAuth, useQuery } from "convex/react";
import type { ReactNode } from "react";
import { SignInForm } from "@/components/account/sign-in-form";
import { useI18n } from "@/locales/client";

/**
 * The workshop's pages, for the accounts on its list (WORKSHOP_EMAILS):
 * anyone else signs in with a code sent to their email, or is told their
 * account isn't on it.
 */
export function WorkshopGate({ children }: { children: ReactNode }) {
  const t = useI18n();
  const { isLoading } = useConvexAuth();
  const { signOut } = useAuthActions();
  const access = useQuery(api.workshop.access, isLoading ? "skip" : {});
  if (access === undefined)
    return <Skeleton className="h-48 max-w-md rounded-3xl" />;
  if (!access.signedIn) return <SignInForm lead={t("workshop.signInLead")} />;
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
