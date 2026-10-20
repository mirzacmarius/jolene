import type { Locale } from "@jolene/i18n";
import en from "./en";
import ro from "./ro";
import type { Dictionary } from "./types";

/**
 * Every language's dictionary, for the server. Imported up front rather than
 * on demand: a render that waits on a module import can't finish within a
 * prerender, and Next drops the layout that waited from its instant checks.
 */
export const dictionaries = { en, ro } satisfies Record<Locale, Dictionary>;
