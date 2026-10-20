import { type FontFamilyName, fontFamilies } from "./catalog";
import type { TextStyle } from "./schema";
import { ptToMm } from "./units";

export interface FontSpec {
  family: FontFamilyName;
  weight: number;
  italic: boolean;
}

/**
 * Width in millimetres of `text` set in `font` at `sizeMm`, before tracking.
 * Browsers measure with the loaded font (react/measure.ts); print files with
 * the font file itself. `estimateWidth` stands in where neither is available.
 */
export type Measure = (text: string, font: FontSpec, sizeMm: number) => number;

export interface TextLine {
  text: string;
  /** Millimetres, tracking included. */
  width: number;
}

export interface TextLayout {
  lines: TextLine[];
  /** The size the text was set at, in points, after any shrinking. */
  size: number;
  /** Distance between baselines, in millimetres. */
  lineHeight: number;
  /** Height of the whole block, in millimetres. */
  height: number;
  /** True when the text is still too big for its frame at `size`. */
  overflows: boolean;
}

export function applyCase(text: string, textCase: TextStyle["case"]): string {
  if (textCase === "upper") return text.toLocaleUpperCase("ro-RO");
  if (textCase === "lower") return text.toLocaleLowerCase("ro-RO");
  return text;
}

const NARROW = new Set("iljtfrI.,;:'!|()[]“”‘’\"-");
const WIDE = new Set("mwMWȘșȚțĂăÂâÎî@%&");
const categoryWidth = { script: 0.82, serif: 1, sans: 1.06 } as const;

/** A rough width from average glyph widths; good enough for a first layout. */
export const estimateWidth: Measure = (text, font, sizeMm) => {
  let ems = 0;
  for (const char of text) {
    if (char === " ") ems += 0.26;
    else if (NARROW.has(char)) ems += 0.3;
    else if (WIDE.has(char)) ems += char === char.toUpperCase() ? 0.82 : 0.72;
    else if (/\d/.test(char)) ems += 0.55;
    else if (char !== char.toLowerCase()) ems += 0.68;
    else ems += 0.5;
  }
  const category = fontFamilies[font.family].category;
  const weight = 1 + Math.max(0, font.weight - 400) / 2000;
  return ems * sizeMm * categoryWidth[category] * weight;
};

export interface LayoutOptions {
  text: string;
  style: TextStyle;
  /** The frame, in millimetres. */
  width: number;
  height: number;
  fit: "none" | "shrink";
  /** Points; shrinking stops here. Defaults to half the style's size. */
  minSize?: number;
  measure?: Measure;
}

const EPSILON = 0.01;

/**
 * Breaks text into lines that fit the frame's width, at the style's size or,
 * with fit "shrink", the largest size at which every line and the whole block
 * fit. Lines break only at spaces and at the text's own line breaks.
 */
export function layoutText(options: LayoutOptions): TextLayout {
  const { style, width, height, fit, measure = estimateWidth } = options;
  const font: FontSpec = {
    family: style.font,
    weight: style.weight,
    italic: style.italic,
  };
  const text = applyCase(options.text, style.case);

  const setAt = (size: number): TextLayout => {
    const sizeMm = ptToMm(size);
    const trackingMm = (style.tracking / 1000) * sizeMm;
    const widthOf = (line: string) =>
      measure(line, font, sizeMm) +
      trackingMm * Math.max(0, [...line].length - 1);
    const lines: TextLine[] = [];
    let overflows = false;
    for (const paragraph of text.split("\n")) {
      const words = paragraph.split(/ +/).filter(Boolean);
      if (words.length === 0) {
        lines.push({ text: "", width: 0 });
        continue;
      }
      let current = words[0] as string;
      for (const word of words.slice(1)) {
        const candidate = `${current} ${word}`;
        if (widthOf(candidate) <= width + EPSILON) current = candidate;
        else {
          lines.push({ text: current, width: widthOf(current) });
          current = word;
        }
      }
      lines.push({ text: current, width: widthOf(current) });
    }
    const lineHeight = sizeMm * style.lineHeight;
    const blockHeight = lines.length * lineHeight;
    if (lines.some((line) => line.width > width + EPSILON)) overflows = true;
    if (blockHeight > height + EPSILON) overflows = true;
    return { lines, size, lineHeight, height: blockHeight, overflows };
  };

  let layout = setAt(style.size);
  if (fit === "none" || !layout.overflows) return layout;

  const floor = options.minSize ?? style.size / 2;
  let size = style.size;
  while (layout.overflows && size > floor) {
    size = Math.max(
      floor,
      Math.round((size - Math.max(0.25, size * 0.03)) * 4) / 4,
    );
    layout = setAt(size);
  }
  return layout;
}
