import { shopConfig } from "@/lib/config";

const ENTITIES: Record<string, string> = {
  amp: "&",
  gt: ">",
  lt: "<",
  nbsp: " ",
  quot: '"',
};

const COUNT_FORMAT = new Intl.NumberFormat(shopConfig.localization.locale);
const PLURAL_RULES = new Intl.PluralRules(shopConfig.localization.locale);

/** A count with its noun in Romanian's three forms: 1 produs, 2 produse, 20 de produse. */
export function formatCount(
  count: number,
  forms: { few: string; one: string; other: string },
): string {
  const rule = PLURAL_RULES.select(count);
  const noun = rule === "one" || rule === "few" ? forms[rule] : forms.other;
  return `${COUNT_FORMAT.format(count)} ${noun}`;
}

/** The words of a product's description, without its markup. */
export function htmlToText(html: string): string {
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/&(#x[\da-f]+|#\d+|[a-z]+);/gi, (entity, name: string) => {
      if (name.startsWith("#x") || name.startsWith("#X"))
        return String.fromCodePoint(Number.parseInt(name.slice(2), 16));
      if (name.startsWith("#")) return String.fromCodePoint(Number(name.slice(1)));
      return ENTITIES[name.toLowerCase()] ?? entity;
    })
    .replace(/\s+/g, " ")
    .trim();
}

export function summarizeText(text: string, maxLength = 200): string {
  const summary = text.replace(/\s+/g, " ").trim();
  return summary.length > maxLength ? `${summary.slice(0, maxLength - 1).trimEnd()}…` : summary;
}
