"use client";

import {
  LANGUAGE_COOKIE,
  type Locale,
  localeNames,
  locales,
} from "@jolene/i18n";
import { SegmentedControl } from "@jolene/ui/segmented-control";
import { useCurrentLocale, useI18n } from "@/locales/client";

const ONE_YEAR_IN_SECONDS = 60 * 60 * 24 * 365;

/**
 * Switches the studio's language. The choice is stored in the cookie the shop
 * reads too, and the page reloads in it: each language is its own prerendered
 * page.
 */
export function LanguageMenu() {
  const t = useI18n();
  const current = useCurrentLocale();
  const choose = (locale: Locale) => {
    if (locale === current) return;
    // biome-ignore lint/suspicious/noDocumentCookie: one plain cookie, read by the proxy on the next request
    document.cookie = `${LANGUAGE_COOKIE}=${locale}; path=/; max-age=${ONE_YEAR_IN_SECONDS}; samesite=lax`;
    window.location.reload();
  };
  return (
    <SegmentedControl
      label={t("common.language")}
      value={current}
      onValueChange={choose}
      options={locales.map((locale) => ({
        value: locale,
        label: (
          <abbr title={localeNames[locale]} className="no-underline">
            {locale.toUpperCase()}
          </abbr>
        ),
      }))}
    />
  );
}
