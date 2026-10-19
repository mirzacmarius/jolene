"use client";

import type { Locale } from "@jolene/i18n";
import { createI18nClient } from "next-international/client";
import {
  type ContextType,
  createElement,
  type ReactNode,
  useContext,
  useMemo,
} from "react";
import { loaders } from "./loaders";
import type { Dictionary } from "./types";

export const { useI18n, useScopedI18n, I18nClientContext } =
  createI18nClient(loaders);

/**
 * The page's language. The library's own hook reads it from the route's
 * params, which a page with its own params (a design's id) only knows at
 * request time; the provider has it from the root layout, in every shell.
 */
export function useCurrentLocale(): Locale {
  const context = useContext(I18nClientContext);
  if (!context) throw new Error("useCurrentLocale needs the I18nProvider");
  return context.locale as Locale;
}

type FlatDictionary = Record<string, string>;

/** { home: { title: "…" } } → { "home.title": "…" }, the shape the translate functions read. */
function flatten(
  dictionary: object,
  prefix = "",
  flat: FlatDictionary = {},
): FlatDictionary {
  for (const [key, value] of Object.entries(dictionary)) {
    if (typeof value === "string") flat[prefix + key] = value;
    else flatten(value, `${prefix}${key}.`, flat);
  }
  return flat;
}

/**
 * Gives client components the dictionary the server already loaded. The
 * library's own provider imports it again in the browser and suspends while it
 * does, which makes React 19 throw away the server-rendered page on hydration.
 */
export function I18nProvider({
  locale,
  dictionary,
  children,
}: {
  locale: Locale;
  dictionary: Dictionary;
  children: ReactNode;
}) {
  const value = useMemo(
    () =>
      ({ locale, localeContent: flatten(dictionary) }) as ContextType<
        typeof I18nClientContext
      >,
    [locale, dictionary],
  );
  return createElement(I18nClientContext.Provider, { value }, children);
}
