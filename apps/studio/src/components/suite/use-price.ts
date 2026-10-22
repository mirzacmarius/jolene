import { useMemo } from "react";
import { useCurrentLocale } from "@/locales/client";

/**
 * Writes a price in bani as the collections show it, in the page's
 * language: whole lei without decimals, "6 lei" and "1 leu", otherwise
 * "6,30 lei".
 */
export function usePrice() {
  const locale = useCurrentLocale();
  return useMemo(() => {
    const tag = locale === "ro" ? "ro-RO" : "en-GB";
    const whole = new Intl.NumberFormat(tag, { maximumFractionDigits: 0 });
    const exact = new Intl.NumberFormat(tag, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    return (bani: number) =>
      bani === 100
        ? "1 leu"
        : `${(bani % 100 === 0 ? whole : exact).format(bani / 100)} lei`;
  }, [locale]);
}
