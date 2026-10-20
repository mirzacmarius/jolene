/**
 * Colours in a design are either a hex value or a reference to one of the
 * theme's palette tokens, written "$accent". Layers that use tokens follow the
 * palette, so recolouring a whole suite is one palette change.
 */

export const paletteTokens = [
  "ink",
  "accent",
  "muted",
  "paper",
  "art",
] as const;
export type PaletteToken = (typeof paletteTokens)[number];

/** "#rrggbb", lower or upper case. */
export type Hex = `#${string}`;
/** A hex colour or "$token". */
export type ColorRef = Hex | `$${PaletteToken}`;
export type Palette = Record<PaletteToken, Hex>;

export const HEX_PATTERN = /^#[0-9a-fA-F]{6}$/;
export const COLOR_REF_PATTERN = new RegExp(
  `^(#[0-9a-fA-F]{6}|\\$(${paletteTokens.join("|")}))$`,
);

export function isHex(value: string): value is Hex {
  return HEX_PATTERN.test(value);
}

export function isColorRef(value: string): value is ColorRef {
  return COLOR_REF_PATTERN.test(value);
}

/** The hex value a reference stands for in `palette`. */
export function resolveColor(ref: ColorRef, palette: Palette): Hex {
  return ref.startsWith("$")
    ? palette[ref.slice(1) as PaletteToken]
    : (ref.toLowerCase() as Hex);
}

export function hexToRgb(hex: Hex): [number, number, number] {
  const value = Number.parseInt(hex.slice(1), 16);
  return [(value >> 16) & 0xff, (value >> 8) & 0xff, value & 0xff];
}

export function rgbToHex([r, g, b]: readonly [number, number, number]): Hex {
  const channel = (n: number) =>
    Math.round(Math.min(255, Math.max(0, n)))
      .toString(16)
      .padStart(2, "0");
  return `#${channel(r)}${channel(g)}${channel(b)}`;
}

/** Mixes `a` towards `b`; `amount` 0 is `a`, 1 is `b`. */
export function mix(a: Hex, b: Hex, amount: number): Hex {
  const from = hexToRgb(a);
  const to = hexToRgb(b);
  return rgbToHex([
    from[0] + (to[0] - from[0]) * amount,
    from[1] + (to[1] - from[1]) * amount,
    from[2] + (to[2] - from[2]) * amount,
  ]);
}

/** WCAG relative luminance, 0 for black to 1 for white. */
export function luminance(hex: Hex): number {
  const [r, g, b] = hexToRgb(hex).map((channel) => {
    const c = channel / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG contrast ratio between two colours, from 1 to 21. */
export function contrast(a: Hex, b: Hex): number {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [
    number,
    number,
  ];
  return (light + 0.05) / (dark + 0.05);
}
