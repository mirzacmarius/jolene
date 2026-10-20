import { describe, expect, test } from "bun:test";
import { foilShades } from "../catalog";
import { palettePresets } from "../palettes";
import {
  type FoilInk,
  foilTones,
  hexToOklab,
  oklabToHex,
  pearlSheen,
  stockThickness,
  tabletopColor,
} from "./materials";

describe("stockThickness", () => {
  test("follows the paper's weight and kind", () => {
    expect(stockThickness("cotton-350")).toBeCloseTo(0.525);
    expect(stockThickness("smooth-300")).toBeCloseTo(0.375);
    expect(stockThickness("vellum-110")).toBeLessThan(0.1);
    expect(stockThickness("cotton-350")).toBeGreaterThan(
      stockThickness("pearl-250"),
    );
  });
});

describe("foilTones", () => {
  test("run from shadow to glint", () => {
    for (const ink of Object.keys(foilShades) as FoilInk[]) {
      const tone = foilTones(ink);
      const lightness = [tone.deep, tone.dark, tone.mid, tone.light, tone.glint]
        .map((color) => hexToOklab(color)[0])
        .map((l) => Math.round(l * 1000));
      expect([ink, lightness]).toEqual([
        ink,
        [...lightness].sort((a, b) => a - b),
      ]);
    }
  });
});

describe("pearlSheen", () => {
  /** How far along the light's path the sheen shows at all. */
  const reach = (stops: ReturnType<typeof pearlSheen>) => {
    const shown = stops.filter(([, , opacity]) => opacity > 0);
    return (shown.at(-1)?.[0] ?? 0) - (shown[0]?.[0] ?? 0);
  };

  test("shimmers in pale colours on light card", () => {
    const [ivory, white] = [pearlSheen("#fbf7ee"), pearlSheen("#ffffff")];
    expect(ivory).toEqual(white);
    for (const [, color] of ivory)
      expect(hexToOklab(color)[0]).toBeGreaterThan(0.9);
  });

  test("keeps dark card deep: a narrower lustre of its own colour", () => {
    const navy = "#1f2a44";
    const [paper, a, b] = hexToOklab(navy);
    const sheen = pearlSheen(navy);
    expect(reach(sheen)).toBeLessThan(reach(pearlSheen("#ffffff")));
    for (const [, color, opacity] of sheen) {
      if (opacity === 0) continue;
      const [lightness, ...hue] = hexToOklab(color);
      expect(lightness - paper).toBeGreaterThan(0.2);
      expect(lightness - paper).toBeLessThan(0.4);
      // Still blue.
      expect(Math.sign(hue[1] ?? 0)).toBe(Math.sign(b));
      expect(Math.abs((hue[0] ?? 0) - a)).toBeLessThan(0.03);
    }
  });
});

describe("tabletopColor", () => {
  test("converts to OKLab and back", () => {
    for (const color of ["#ffffff", "#2f7a49", "#bf7a8c", "#000000"] as const)
      expect(oklabToHex(hexToOklab(color))).toBe(color);
  });

  test("is a light, quiet linen for every palette", () => {
    for (const [id, { palette }] of Object.entries(palettePresets)) {
      const [lightness, a, b] = hexToOklab(tabletopColor(palette));
      expect([id, Math.abs(lightness - 0.87) < 0.01]).toEqual([id, true]);
      expect([id, Math.hypot(a, b) < 0.035]).toEqual([id, true]);
    }
  });

  test("leans towards the artwork's colour, not the lettering's", () => {
    const palette = {
      ink: "#0b1e4f",
      accent: "#0b1e4f",
      muted: "#aab0bb",
      paper: "#ffffff",
      art: "#5e8c76",
    } as const;
    const hue = (color: `#${string}`) => {
      const [, a, b] = hexToOklab(color);
      return Math.atan2(b, a);
    };
    const apart = Math.abs(hue(tabletopColor(palette)) - hue(palette.art));
    expect(Math.min(apart, 2 * Math.PI - apart)).toBeLessThan(1);
  });
});
