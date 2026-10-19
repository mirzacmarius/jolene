import type { Locale } from "@jolene/i18n";
import type { Dictionary } from "./types";

/**
 * One dictionary per supported language; a language without one fails
 * typecheck. English comes first: its literal texts give the translate
 * functions their parameters, such as {suite}.
 */
export const loaders = {
  en: () => import("./en"),
  ro: () => import("./ro"),
} satisfies Record<Locale, () => Promise<{ default: Dictionary }>>;
