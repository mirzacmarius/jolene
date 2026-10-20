import { describe, expect, test } from "bun:test";
import { fontCategories, fontFamilies } from "./catalog";
import { googleFontsHref } from "./fonts";

describe("googleFontsHref", () => {
  const href = googleFontsHref();
  const families = new URL(href).searchParams.getAll("family");

  test("asks for every family in the catalog, once", () => {
    expect(families.map((family) => family.split(":")[0])).toEqual(
      Object.keys(fontFamilies),
    );
  });

  test("asks for each weight, and italics where a family has them", () => {
    expect(families).toContain(
      "Raleway:ital,wght@0,300;0,400;0,500;0,600;0,700;1,300;1,400;1,500;1,600;1,700",
    );
    expect(families).toContain("Cinzel Decorative:wght@400;700;900");
    expect(googleFontsHref(["Ballet"])).toBe(
      "https://fonts.googleapis.com/css2?family=Ballet:wght@400&display=swap",
    );
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
