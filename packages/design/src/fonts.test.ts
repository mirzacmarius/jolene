import { describe, expect, test } from "bun:test";
import { fontCategories, fontFamilies } from "./catalog";
import {
  fontCharacters,
  googleFontsHref,
  matchWeight,
  symbolCharacters,
  symbolFonts,
} from "./fonts";

describe("googleFontsHref", () => {
  const href = googleFontsHref();
  const families = new URL(href).searchParams.getAll("family");

  test("asks for every family in the catalog once, then the symbol faces", () => {
    expect(families.map((family) => family.split(":")[0])).toEqual([
      ...Object.keys(fontFamilies),
      ...symbolFonts,
    ]);
  });

  test("asks for each weight, and italics where a family has them", () => {
    expect(families).toContain(
      "Raleway:ital,wght@0,300;0,400;0,500;0,600;0,700;1,300;1,400;1,500;1,600;1,700",
    );
    expect(families).toContain("Cinzel Decorative:wght@400;700;900");
    expect(googleFontsHref(["Ballet"])).toStartWith(
      "https://fonts.googleapis.com/css2?family=Ballet:wght@400&family=Noto+Sans+Symbols+2&family=Noto+Sans+Symbols&family=Noto+Sans+Math&text=",
    );
  });

  test("asks for Romanian and Western European letters in one file", () => {
    const text = new URL(href).searchParams.get("text") ?? "";
    expect(text).toBe(fontCharacters);
    for (const letter of "ăâîșțĂÂÎȘȚéèçñöüß„”–…€")
      expect(text).toContain(letter);
    for (const symbol of symbolCharacters) expect(text).toContain(symbol);
    expect(new Set(text).size).toBe([...text].length);
    expect(href).toEndWith("&display=swap");
  });
});

describe("matchWeight", () => {
  test("keeps a weight the family has", () => {
    expect(matchWeight("Raleway", 300)).toBe(300);
  });

  test("picks the weight a browser would draw", () => {
    // From 400 to 500, a bolder weight up to 500, then the lighter ones.
    expect(matchWeight("Cinzel Decorative", 500)).toBe(400);
    expect(matchWeight("Montserrat", 450)).toBe(500);
    // Below 400, lighter first; above 500, bolder first.
    expect(matchWeight("Lora", 300)).toBe(400);
    expect(matchWeight("Cinzel Decorative", 800)).toBe(900);
    expect(matchWeight("Montserrat", 700)).toBe(600);
    expect(matchWeight("Great Vibes", 700)).toBe(400);
  });
});

describe("fontFamilies", () => {
  test("offers a choice in every category", () => {
    for (const category of fontCategories)
      expect(
        Object.values(fontFamilies).filter(
          (family) => family.category === category,
        ).length,
      ).toBeGreaterThanOrEqual(8);
  });
});
