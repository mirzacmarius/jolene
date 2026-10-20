import { foilShades, type Ink, type StockId, stocks } from "../catalog";
import { type Hex, hexToRgb, mix, type Palette, rgbToHex } from "../color";

/**
 * How the lifelike preview reads paper, metal and light from the catalog:
 * a sheet's thickness from its weight, the tones of each foil, and the colour
 * of the table the suite is photographed on. Pure, for the renderer and its
 * tests.
 */

/**
 * Marks what moves with the light in a lifelike view: the glint on foil, the
 * gloss of spot UV, the sheen of pearl, vellum, satin and wax. It holds how
 * far each moves when the light is furthest right and down, across then
 * down, in the units it's drawn in; the page moves them all (moveLight). At
 * rest the light is in the middle, and nothing has moved.
 */
export const FOLLOW_LIGHT = "data-lifelike-follow";

/** Marks an element to move with the light, by `x` across and `y` down. */
export function followLight(x: number, y: number = x) {
  return { [FOLLOW_LIGHT]: `${x} ${y}` } as { "data-lifelike-follow": string };
}

/**
 * Cubic centimetres per gram: cotton is spongy and stands thick for its
 * weight, vellum is pressed dense.
 */
const bulk = {
  cotton: 1.5,
  linen: 1.3,
  smooth: 1.25,
  pearl: 1.2,
  kraft: 1.3,
  vellum: 0.85,
} as const;

/** A sheet's thickness in millimetres: 0.5 for cotton 350 g, 0.1 for vellum. */
export function stockThickness(stock: StockId): number {
  const { gsm, texture } = stocks[stock];
  return (gsm * bulk[texture]) / 1000;
}

export type FoilInk = Extract<Ink, `foil-${string}`>;

export function isFoil(ink: Ink): ink is FoilInk {
  return ink.startsWith("foil-");
}

/** A foil's tones from its shadow to its brightest glint. */
export function foilTones(ink: FoilInk) {
  const [dark, light, mid] = foilShades[ink] as [Hex, Hex, Hex];
  return {
    deep: mix(dark, "#000000", 0.38),
    dark,
    mid,
    light,
    glint: mix(light, "#ffffff", 0.72),
  };
}

// OKLab, so lightness and chroma mean what they look like.
// https://bottosson.github.io/posts/oklab/
const toLinear = (channel: number) => {
  const c = channel / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
};
const fromLinear = (c: number) =>
  255 *
  (c <= 0.0031308 ? 12.92 * c : 1.055 * Math.max(0, c) ** (1 / 2.4) - 0.055);

type Lab = [number, number, number];

export function hexToOklab(hex: Hex): Lab {
  const [r, g, b] = hexToRgb(hex).map(toLinear) as Lab;
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}

export function oklabToHex([lightness, a, b]: Lab): Hex {
  const l = (lightness + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (lightness - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (lightness - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return rgbToHex([
    fromLinear(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s),
    fromLinear(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s),
    fromLinear(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s),
  ]);
}

/** A gradient stop: where along the light's path, its colour and opacity. */
export type SheenStop = [offset: number, color: Hex, opacity: number];

/** Pearlescent card's shimmer on light card: pale colours sliding past. */
const PEARL: SheenStop[] = [
  [0, "#ffffff", 0],
  [0.32, "#ffe4ec", 0],
  [0.4, "#ffeedd", 0.26],
  [0.46, "#fffaf0", 0.36],
  [0.52, "#e3f5ee", 0.24],
  [0.58, "#e5e2fb", 0.2],
  [0.68, "#ffffff", 0],
  [1, "#ffffff", 0],
];
/** Where the shimmer is brightest. */
const PEARL_MIDDLE = 0.47;

/**
 * The sheen of pearlescent card in a given colour. Light card shimmers with
 * pale colours; dark card, where pale would wash it out, shows a narrower
 * lustre of its own colour, lighter, and keeps its depth.
 */
export function pearlSheen(paper: Hex): SheenStop[] {
  const [lightness, a, b] = hexToOklab(paper);
  // 0 for light card, 1 for dark.
  const dark = Math.min(1, Math.max(0, (0.75 - lightness) / 0.4));
  if (dark === 0) return PEARL;
  const lustre = oklabToHex([
    Math.min(0.92, lightness + 0.3),
    a * 0.85,
    b * 0.85,
  ]);
  const narrow = 1 - 0.35 * dark;
  return PEARL.map(([offset, color, opacity]) => [
    offset === 0 || offset === 1
      ? offset
      : Math.round((PEARL_MIDDLE + (offset - PEARL_MIDDLE) * narrow) * 1000) /
        1000,
    mix(color, lustre, dark),
    opacity * (1 - 0.15 * dark),
  ]);
}

/** Undyed linen, in OKLab: light, with a little warmth. */
const LINEN: Lab = [0.87, 0.0033, 0.0157];

/**
 * The linen tablecloth a suite lies on: undyed linen, leaning a little
 * towards the design's artwork colour so the photograph feels of a piece with
 * it, and light enough that any card stands out from it.
 */
export function tabletopColor(palette: Palette): Hex {
  // The artwork's colour says most about a design; the text's, least.
  const sources: [Hex, number][] = [
    [palette.art, 1],
    [palette.accent, 0.9],
    [palette.paper, 0.8],
    [palette.ink, 0.3],
  ];
  let lean: Lab | null = null;
  let best = 0;
  for (const [color, weight] of sources) {
    const [lightness, a, b] = hexToOklab(color);
    const chroma = Math.hypot(a, b);
    // Dark colours are mostly for lettering; they set a design's mood less.
    const presence = Math.min(1, Math.max(0.25, (lightness - 0.2) / 0.4));
    if (chroma * weight * presence > best) {
      best = chroma * weight * presence;
      // Greys say nothing about a hue; colours lend the cloth up to half of
      // a soft version of theirs.
      const amount = Math.min(1, Math.max(0, (chroma - 0.02) / 0.08)) * 0.5;
      lean = [0, (a / chroma) * 0.028 * amount, (b / chroma) * 0.028 * amount];
    }
  }
  const [lightness, a, b] = LINEN;
  if (!lean) return oklabToHex(LINEN);
  const keep = 1 - Math.hypot(lean[1], lean[2]) / 0.028;
  return oklabToHex([lightness, a * keep + lean[1], b * keep + lean[2]]);
}
