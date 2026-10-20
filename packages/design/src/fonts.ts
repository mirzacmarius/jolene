import { type FontFamilyName, fontFamilies } from "./catalog";

/**
 * The Google Fonts stylesheet for the typefaces a design may use, every
 * weight and italic the catalog offers. Families load only once a page draws
 * text in them, so listing them all costs nothing until they're used.
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
  return `https://fonts.googleapis.com/css2?${params.join("&")}&display=swap`;
}
