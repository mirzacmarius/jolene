/**
 * An amount in lei as someone types it, such as 300, 300,50 or 300.50, in
 * bani: null for anything else, so a typo never refunds the wrong sum.
 */
export function parseLei(text: string): number | null {
  const match = /^\s*(\d{1,7})(?:[.,](\d{1,2}))?\s*(?:lei)?\s*$/i.exec(text);
  if (!match?.[1]) return null;
  return Number(match[1]) * 100 + Number((match[2] ?? "").padEnd(2, "0"));
}

/** Bani as lei to type into a field, without thousands: 1000,50 or 1000.50. */
export function leiField(bani: number, locale: "ro" | "en"): string {
  const lei = (bani / 100).toFixed(2);
  return locale === "ro" ? lei.replace(".", ",") : lei;
}
