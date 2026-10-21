"use client";

import type { Locale } from "@jolene/i18n";
import { ConvexProvider, ConvexReactClient } from "convex/react";
import type { ReactNode } from "react";
import { env } from "@/env";
import { I18nProvider } from "@/locales/client";
import type { Dictionary } from "@/locales/types";

const convex = new ConvexReactClient(env.NEXT_PUBLIC_CONVEX_URL);

/**
 * What a guest's page runs in: Convex without signing in, since guests
 * answer by their link, and the invitation's language.
 */
export function GuestProviders({
  locale,
  dictionary,
  children,
}: {
  locale: Locale;
  dictionary: Dictionary;
  children: ReactNode;
}) {
  return (
    <I18nProvider locale={locale} dictionary={dictionary}>
      <ConvexProvider client={convex}>{children}</ConvexProvider>
    </I18nProvider>
  );
}
