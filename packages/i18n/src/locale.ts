/**
 * The languages Jolene speaks. Romanian comes first: it is the default for
 * anyone whose browser asks for neither.
 */
export const locales = ["ro", "en"] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = "ro";

/**
 * The cookie that holds a visitor's chosen language, shared by the shop and
 * the studio, which sit on one domain.
 */
export const LANGUAGE_COOKIE = "jolene-language";

/** Each language's own name for itself, as the language menu shows it. */
export const localeNames: Record<Locale, string> = {
  ro: "Română",
  en: "English",
};

export function isLocale(value: unknown): value is Locale {
  return (
    typeof value === "string" && (locales as readonly string[]).includes(value)
  );
}

/** Maps a BCP 47 tag such as "ro-MD" or "en-GB" to a supported locale. */
export function matchLocale(tag: string): Locale | undefined {
  const language = tag.trim().toLowerCase().split("-")[0];
  if (language === "mo") return "ro";
  return isLocale(language) ? language : undefined;
}

/** The tags of an Accept-Language header, best first. */
export function preferredTags(acceptLanguage: string): string[] {
  return acceptLanguage
    .split(",")
    .map((part, index) => {
      const [tag = "", ...params] = part.trim().split(";");
      const quality = params
        .map((p) => p.trim())
        .find((p) => p.startsWith("q="));
      const weight = quality ? Number(quality.slice(2)) : 1;
      return {
        tag: tag.trim(),
        weight: Number.isFinite(weight) ? weight : 0,
        index,
      };
    })
    .filter(({ tag, weight }) => tag && tag !== "*" && weight > 0)
    .sort((a, b) => b.weight - a.weight || a.index - b.index)
    .map(({ tag }) => tag);
}

/**
 * Picks the language to show: the visitor's stored choice, else the
 * browser's best supported language, else Romanian.
 */
export function resolveLocale({
  stored,
  acceptLanguage,
}: {
  stored?: string | null;
  acceptLanguage?: string | null;
}): Locale {
  const fromStored = stored ? matchLocale(stored) : undefined;
  if (fromStored) return fromStored;
  for (const tag of preferredTags(acceptLanguage ?? "")) {
    const match = matchLocale(tag);
    if (match) return match;
  }
  return defaultLocale;
}
