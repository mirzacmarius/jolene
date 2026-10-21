import { shopConfig } from "@/lib/config";

export const CURRENCY_CODE = "RON";

const PRICE_FORMAT = new Intl.NumberFormat(shopConfig.localization.locale, {
  currency: CURRENCY_CODE,
  currencyDisplay: "narrowSymbol",
  style: "currency",
});

// Convex keeps prices in bani; narrowSymbol writes RON as "lei", as Romanian shops do.
export function formatPrice(bani: number): string {
  return PRICE_FORMAT.format(bani / 100);
}

/** A price as schema.org and Open Graph write it: lei, with two decimals. */
export function toAmount(bani: number): string {
  return (bani / 100).toFixed(2);
}
