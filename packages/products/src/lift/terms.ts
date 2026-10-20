import type { FeeKey } from "../catalog";

/**
 * "Comandă minimă: 30 buc.", "Cantitate minimă: 20 buc", "Număr minim de
 * comandă: 40 buc.", "Comanda minima este de 30".
 */
const minimum =
  /(?<![\p{L}\d])minim(?:ă|a|um)?(?![\p{L}\d])(?:\s+de\s+comand[ăa])?\s*(?:[:\-–]|este\s+de|de)?\s*(\d+)/giu;

/** The smallest quantity a product's description says Jolene takes. */
export function minQuantity(text: string): number | undefined {
  const found = new Set<number>();
  for (const match of text.matchAll(minimum)) {
    const end = match.index + match[0].length;
    // "minimum 2 meniuri per masă" is advice, not an order's minimum.
    if (text.slice(end, end + 25).includes("per mas")) continue;
    found.add(Number(match[1]));
  }
  if (found.size > 1)
    throw new Error(`Two minimum quantities: ${[...found].join(", ")}`);
  return [...found][0];
}

/** "Diacriticele se adaugă contra cost – 50 ron." */
const diacritics = /diacritic[^.]{0,120}?(\d+)\s*(?:ron|lei)/iu;

/** "… taxă de urgență de 200 ron." */
const urgency = /urgen[tț][ăa][^.]{0,80}?(\d+)\s*(?:ron|lei)/iu;

/** The one-off charges a product's description mentions. */
export function feesIn(text: string): FeeKey[] {
  const fees: FeeKey[] = [];
  const forDiacritics = diacritics.exec(text)?.[1];
  if (forDiacritics === "50") fees.push("diacritice-50");
  else if (forDiacritics === "10") fees.push("diacritice-10");
  else if (forDiacritics)
    throw new Error(`Diacritics cost ${forDiacritics} lei, an unknown fee`);
  const forUrgency = urgency.exec(text)?.[1];
  if (forUrgency === "200") fees.push("comanda-urgenta");
  else if (forUrgency)
    throw new Error(`An urgent order costs ${forUrgency} lei, an unknown fee`);
  return fees;
}
