import { type FontFamilyName, fontFamilies } from "./catalog";

/**
 * The faces a browser takes a symbol from when the typeface lacks it, in this
 * order: the studio lists them after each typeface (react/shared.ts), and the
 * print file falls back to them the same way, so a heart or a cross prints as
 * the screen shows it.
 */
export const symbolFonts = [
  "Noto Sans Symbols 2",
  "Noto Sans Symbols",
  "Noto Sans Math",
] as const;
export type SymbolFontName = (typeof symbolFonts)[number];

/**
 * The symbols couples write that the studio loads the symbol faces for:
 * hearts, fleurons, stars, ticks, shapes, flowers, the sky, crosses, a dove,
 * infinity and arrows. None is drawn as a colour emoji by default, which no
 * press could print.
 */
export const symbolCharacters =
  "♥♡❤❥❣❦❧☙★☆✩✪✫✬✭✮✯✰✦✧✱✲✳✴✵✶✷✸✹✺❂✢✣✤✥❖✓✔✗✘◯○●◦◇◆□■♦♢❀❁✿❃❋✾✽✻✼❄❅❆⚘☀☼☁☂☾☽☺✉✈☎☏♪♫♬✝✞✟☩✠☦☧☨🕊⚭∞←→↔";

/**
 * Every character the studio's fonts are asked for: Latin with Latin-1 and
 * Latin Extended-A, the comma-below ș and ț, typographic punctuation, and the
 * symbols. Google Fonts then sends each face as a single file. Split by
 * alphabet, as it does by default, a browser shapes ă, ș and ț apart from the
 * letters around them and loses the kerning between them, so the words would
 * set narrower in the print file, which has the whole font, than on screen.
 */
export const fontCharacters: string = [
  ...new Set([
    ...range(0x20, 0x7e),
    ...range(0xa0, 0x17f),
    ...range(0x218, 0x21b),
    ..."‘’‚“”„–—…•€",
    ...symbolCharacters,
  ]),
].join("");

function range(from: number, to: number): string[] {
  return Array.from({ length: to - from + 1 }, (_, index) =>
    String.fromCodePoint(from + index),
  );
}

/**
 * The Google Fonts stylesheet for the typefaces a design may use, every
 * weight and italic the catalog offers, and the symbol faces. Families load
 * only once a page draws text in them, so listing them all costs nothing until
 * they're used.
 */
export function googleFontsHref(
  families: readonly FontFamilyName[] = Object.keys(
    fontFamilies,
  ) as FontFamilyName[],
): string {
  const params = families.map((family) => {
    const { weights, italic } = fontFamilies[family];
    const name = family.replaceAll(" ", "+");
    if (!italic) return `family=${name}:wght@${weights.join(";")}`;
    const axes = [
      ...weights.map((weight) => `0,${weight}`),
      ...weights.map((weight) => `1,${weight}`),
    ];
    return `family=${name}:ital,wght@${axes.join(";")}`;
  });
  for (const family of symbolFonts)
    params.push(`family=${family.replaceAll(" ", "+")}`);
  const text = encodeURIComponent(fontCharacters);
  return `https://fonts.googleapis.com/css2?${params.join("&")}&text=${text}&display=swap`;
}

/**
 * The weight a family has that a browser draws for the one asked for, by the
 * CSS matching rules: the weight itself, else from 400 to 500 a bolder one up
 * to 500, then the lighter ones; below 400 the lighter ones first, and above
 * 500 the bolder ones first.
 */
export function matchWeight(family: FontFamilyName, weight: number): number {
  const weights: number[] = [...fontFamilies[family].weights].sort(
    (a, b) => a - b,
  );
  if (weights.includes(weight)) return weight;
  const lighter = weights.filter((candidate) => candidate < weight).reverse();
  const bolder = weights.filter((candidate) => candidate > weight);
  const order =
    weight >= 400 && weight <= 500
      ? [
          ...bolder.filter((candidate) => candidate <= 500),
          ...lighter,
          ...bolder.filter((candidate) => candidate > 500),
        ]
      : weight < 400
        ? [...lighter, ...bolder]
        : [...bolder, ...lighter];
  return order[0] as number;
}
