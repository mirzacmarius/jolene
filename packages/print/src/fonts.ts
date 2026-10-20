import {
  type FontFamilyName,
  type FontSpec,
  fontFamilies,
  type Measure,
  matchWeight,
  type SymbolFontName,
  symbolFonts,
} from "@jolene/design";
import { create, type Font } from "fontkit";

/** One face of a family, as its font file has it. */
export interface Face {
  family: FontFamilyName | SymbolFontName;
  weight: number;
  italic: boolean;
}

/** The bytes of a face's TrueType file. */
export type FontSource = (face: Face) => Promise<Uint8Array>;

/**
 * A face to draw a style with: the one a browser picks for it, and what the
 * browser fakes when the family lacks it (a slanted roman for a missing
 * italic, a thickened weight for a missing bold), which the print file fakes
 * the same way.
 */
export interface FaceChoice {
  face: Face;
  font: Font;
  fakeItalic: boolean;
  fakeBold: boolean;
}

/** Part of a line drawn in one face. */
export interface TextRun {
  text: string;
  choice: FaceChoice;
}

export function faceFor(spec: FontSpec): {
  face: Face;
  fakeItalic: boolean;
  fakeBold: boolean;
} {
  const family = fontFamilies[spec.family];
  const weight = matchWeight(spec.family, spec.weight);
  const italic = spec.italic && family.italic;
  return {
    face: { family: spec.family, weight, italic },
    fakeItalic: spec.italic && !family.italic,
    // Browsers thicken a face for a bold it lacks: 600 and up drawn with a
    // face under 600.
    fakeBold: spec.weight >= 600 && weight < 600,
  };
}

const faceKey = (face: Face) =>
  `${face.family}|${face.weight}|${face.italic ? "italic" : "roman"}`;

/** The symbol faces have a regular face only. */
const symbolFace = (family: SymbolFontName): Face => ({
  family,
  weight: 400,
  italic: false,
});

const hasGlyph = (font: Font, letter: string) =>
  font.hasGlyphForCodePoint(letter.codePointAt(0) as number);

/**
 * The faces a print file draws, loaded from their files. Text is measured with
 * the same files it is drawn with, so lines break where the studio breaks them:
 * the studio's fonts hold the same glyphs, kerning and ligatures.
 */
export class FontBook {
  private readonly fonts = new Map<string, Font>();
  private readonly loading = new Map<string, Promise<Font>>();
  /** Widths in ems, by face and text: layouts measure the same words often. */
  private readonly widths = new Map<string, number>();

  constructor(private readonly source: FontSource) {}

  /**
   * Loads the faces these words are drawn with: each style's own, and the
   * symbol faces once a word has a letter its face lacks.
   */
  async load(texts: Iterable<{ spec: FontSpec; text: string }>): Promise<void> {
    const wanted = [...texts];
    await this.loadFaces(wanted.map(({ spec }) => faceFor(spec).face));
    const lacking = wanted.some(({ spec, text }) => {
      const { font } = this.choose(spec);
      return [...text].some(
        (letter) => letter !== "\n" && !hasGlyph(font, letter),
      );
    });
    if (lacking) await this.loadFaces(symbolFonts.map(symbolFace));
  }

  private async loadFaces(faces: Face[]): Promise<void> {
    const unique = new Map(faces.map((face) => [faceKey(face), face]));
    await Promise.all(
      [...unique].map(async ([key, face]) => {
        if (this.fonts.has(key)) return;
        let pending = this.loading.get(key);
        if (!pending) {
          pending = this.source(face).then((bytes) => {
            const font = create(Buffer.from(bytes));
            if (!("layout" in font))
              throw new Error(`${face.family} came as a font collection`);
            return font;
          });
          this.loading.set(key, pending);
          pending.catch(() => this.loading.delete(key));
        }
        this.fonts.set(key, await pending);
      }),
    );
  }

  /** The loaded face for a style; load() it first. */
  choose(spec: FontSpec): FaceChoice {
    const choice = faceFor(spec);
    const font = this.fonts.get(faceKey(choice.face));
    if (!font)
      throw new Error(`${faceKey(choice.face)} was not loaded for printing`);
    return { ...choice, font };
  }

  /**
   * A line in runs of one face each, as a browser sets it from the studio's
   * font list: each letter from the style's face, else from the first symbol
   * face that has it, which is faked bold or italic as the style asks. A
   * letter no face has stays with the style's face, which draws it as an
   * empty box, except a space, drawn as a plain one.
   */
  runs(text: string, spec: FontSpec): TextRun[] {
    const own = this.choose(spec);
    const runs: TextRun[] = [];
    for (const letter of text) {
      let choice = own;
      let drawn = letter;
      if (!hasGlyph(own.font, letter)) {
        const symbol = this.symbolFor(letter);
        if (symbol)
          choice = {
            ...symbol,
            fakeItalic: spec.italic,
            fakeBold: spec.weight >= 600,
          };
        else if (/\s/.test(letter)) drawn = " ";
      }
      const last = runs.at(-1);
      if (last && last.choice.font === choice.font) last.text += drawn;
      else runs.push({ text: drawn, choice });
    }
    return runs;
  }

  private symbolFor(letter: string): { face: Face; font: Font } | undefined {
    for (const family of symbolFonts) {
      const face = symbolFace(family);
      const font = this.fonts.get(faceKey(face));
      if (font && hasGlyph(font, letter)) return { face, font };
    }
    return undefined;
  }

  /** Whether some face draws the letter in this style. */
  draws(letter: string, spec: FontSpec): boolean {
    return (
      hasGlyph(this.choose(spec).font, letter) ||
      this.symbolFor(letter) !== undefined
    );
  }

  /** Measures as the studio does (react/measure.ts), from the font files. */
  readonly measure: Measure = (text, spec, sizeMm) => {
    let ems = 0;
    for (const { text: part, choice } of this.runs(text, spec)) {
      const key = `${faceKey(choice.face)}|${part}`;
      let width = this.widths.get(key);
      if (width === undefined) {
        width = choice.font.layout(part).advanceWidth / choice.font.unitsPerEm;
        this.widths.set(key, width);
      }
      ems += width;
    }
    return ems * sizeMm;
  };
}

/**
 * Where a face's middle sits above its baseline, in ems: browsers centre a
 * line on its middle (dominant-baseline central), halfway between the font's
 * ascent and descent. Those are its typographic metrics when the font says to
 * use them, else the horizontal header's, as Chrome reads them.
 */
export function middleAboveBaseline(font: Font): number {
  const os2 = font["OS/2"];
  const [ascent, descent] = os2?.fsSelection?.useTypoMetrics
    ? [os2.typoAscender, os2.typoDescender]
    : [font.ascent, font.descent];
  return (ascent + descent) / 2 / font.unitsPerEm;
}

/**
 * Faces from Google Fonts, whole: asked for without a browser's name, Google
 * sends TrueType files with every glyph rather than WOFF2 files cut by
 * alphabet.
 */
export function googleFonts(
  fetcher: typeof fetch = fetch,
  attempts = 3,
): FontSource {
  return async (face) => {
    const family = face.family.replaceAll(" ", "+");
    const href = `https://fonts.googleapis.com/css2?family=${family}:ital,wght@${face.italic ? 1 : 0},${face.weight}`;
    const css = await fetchWithRetry(fetcher, href, attempts).then((response) =>
      response.text(),
    );
    const url = /url\((https:[^)]+\.ttf)\)/.exec(css)?.[1];
    if (!url) throw new Error(`Google Fonts has no TrueType file for ${href}`);
    const file = await fetchWithRetry(fetcher, url, attempts);
    return new Uint8Array(await file.arrayBuffer());
  };
}

async function fetchWithRetry(
  fetcher: typeof fetch,
  url: string,
  attempts: number,
): Promise<Response> {
  let failure: unknown;
  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      const response = await fetcher(url, {
        headers: { "user-agent": "Jolene print files" },
      });
      if (response.ok) return response;
      failure = new Error(`${response.status} for ${url}`);
      if (response.status < 500) break;
    } catch (error) {
      failure = error;
    }
    if (attempt + 1 < attempts)
      await new Promise((resolve) => setTimeout(resolve, 500 * 2 ** attempt));
  }
  throw failure;
}
