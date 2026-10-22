"use client";

import { useAuthActions } from "@convex-dev/auth/react";
import { Button } from "@jolene/ui/button";
import { toast } from "@jolene/ui/toaster";
import { LoaderCircle } from "lucide-react";
import { useState } from "react";
import { useI18n } from "@/locales/client";

/** Google's G, as its sign-in buttons show it. */
function GoogleMark() {
  return (
    <svg viewBox="0 0 48 48" aria-hidden className="size-4">
      <path
        fill="#FFC107"
        d="M43.6 20.1H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 8 3l5.7-5.6C34 6.1 29.3 4 24 4 13 4 4 13 4 24s9 20 20 20 20-9 20-20c0-1.3-.1-2.6-.4-3.9z"
      />
      <path
        fill="#FF3D00"
        d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 8 3l5.7-5.6C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"
      />
      <path
        fill="#4CAF50"
        d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2A11.9 11.9 0 0 1 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z"
      />
      <path
        fill="#1976D2"
        d="M43.6 20.1H42V20H24v8h11.3a12 12 0 0 1-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.6-.4-3.9z"
      />
    </svg>
  );
}

/**
 * Signs Jolene's team in to the workshop with Google (Convex Auth's Google
 * provider, packages/backend/convex/auth.ts). Google brings the browser back
 * to the page it set off from, and only this browser can take its answer, so
 * on an address Google can't come back to, the page links to one it can.
 */
export function GoogleSignIn({
  lead,
  origins,
}: {
  lead: string;
  /** Where Google can come back to, the one to send the team to first. */
  origins: string[];
}) {
  const t = useI18n();
  const { signIn } = useAuthActions();
  const [opening, setOpening] = useState(false);
  // The workshop's pages only render this in the browser, once they know
  // who's signed in.
  const here = new URL(window.location.href);
  const there =
    origins.length > 0 && !origins.includes(here.origin)
      ? new URL(here.pathname + here.search, origins[0])
      : null;

  const open = () => {
    setOpening(true);
    here.searchParams.delete("code");
    signIn("google", { redirectTo: here.href }).catch(() => {
      setOpening(false);
      toast.error(t("common.error"));
    });
  };

  return (
    <div className="max-w-md">
      <h2 className="font-display text-3xl">{t("account.signInTitle")}</h2>
      <p className="mt-2 text-muted-foreground">{lead}</p>
      {there ? (
        <div className="mt-6 flex flex-col items-start gap-3">
          <p className="text-sm">
            {t("workshop.googleThere", { host: there.host })}
          </p>
          <Button asChild>
            <a href={there.href}>
              {t("workshop.goThere", { host: there.host })}
            </a>
          </Button>
        </div>
      ) : (
        <Button
          variant="outline"
          className="mt-6"
          disabled={opening}
          onClick={open}
        >
          {opening ? (
            <LoaderCircle className="animate-spin" aria-hidden />
          ) : (
            <GoogleMark />
          )}
          {opening ? t("workshop.googleOpening") : t("workshop.google")}
        </Button>
      )}
    </div>
  );
}
