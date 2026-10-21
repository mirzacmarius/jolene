import { useMemo } from "react";
import { useCurrentLocale } from "@/locales/client";

/** How the workshop writes amounts, times and countries, in the page's language. */
export function useFormats() {
  const locale = useCurrentLocale();
  return useMemo(() => {
    const tag = locale === "ro" ? "ro-RO" : "en-GB";
    const amount = new Intl.NumberFormat(tag, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    const time = new Intl.DateTimeFormat(tag, {
      day: "numeric",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
    const day = new Intl.DateTimeFormat(tag, {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
    const regions = new Intl.DisplayNames(tag, { type: "region" });
    return {
      /** An amount in bani, in lei: "1.234,50 lei". */
      lei: (bani: number) => `${amount.format(bani / 100)} lei`,
      time: (at: number) => time.format(at),
      day: (at: number) => day.format(at),
      /** A country's name from its two letters, such as România for RO. */
      country: (code: string) => {
        try {
          return regions.of(code) ?? code;
        } catch {
          return code;
        }
      },
    };
  }, [locale]);
}
