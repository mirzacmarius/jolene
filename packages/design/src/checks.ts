import { type Fields, fieldKeysUsed, resolveText } from "./fields";
import { fontCharacters } from "./fonts";
import {
  type DesignDocument,
  type FaceName,
  faceNames,
  type ImageLayer,
  type Piece,
  type TextLayer,
} from "./schema";
import {
  type FontSpec,
  layoutText,
  lineMiddles,
  type Measure,
  type TextLayout,
} from "./text-layout";
import { ptToMm } from "./units";

/**
 * What to look at before a design prints: the couple sees it on their proof,
 * the workshop in the print file. Both follow these rules, each measuring the
 * words with the fonts it has: the studio with the browser's, the print file
 * with the font files.
 */

/** Images are checked against this resolution, as print shops ask. */
export const PRINT_DPI = 300;

/** Something the workshop or the couple should look at before printing. */
export type PrintIssue =
  /** Details the design uses that the couple hasn't given: they don't print. */
  | { kind: "missing-details"; fields: string[] }
  /** Words too long for their frame even at the smallest size allowed. */
  | { kind: "overflow"; piece: string; face: FaceName; layer: string }
  /** The couple's words reach past the safe margin, towards the cut. */
  | { kind: "outside-safe-area"; piece: string; face: FaceName; layer: string }
  /** A photo frame the couple hasn't filled: it prints empty. */
  | { kind: "missing-photo"; piece: string; face: FaceName; layer: string }
  | {
      kind: "missing-artwork";
      piece: string;
      face: FaceName;
      layer: string;
      asset: string;
    }
  /** An image printed below 300 dpi. */
  | {
      kind: "low-resolution";
      piece: string;
      face: FaceName;
      layer: string;
      dpi: number;
    }
  /** Letters neither the typeface nor a symbol face has: empty boxes. */
  | {
      kind: "missing-glyphs";
      piece: string;
      face: FaceName;
      layer: string;
      characters: string;
    }
  /**
   * Letters the studio doesn't load its typefaces for (fontCharacters): the
   * screen shows them in another font, the print file in the design's.
   */
  | {
      kind: "unusual-characters";
      piece: string;
      face: FaceName;
      layer: string;
      characters: string;
    };

export type PrintIssueKind = PrintIssue["kind"];

/** Where a line's letters reach, in millimetres. */
export interface LetterBounds {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

/** An image's size in pixels. */
export interface PictureSize {
  width: number;
  height: number;
}

export interface CheckOptions {
  /** Widths of text, as the layout measures them; the estimate if left out. */
  measure?: Measure;
  /**
   * Where a line's letters reach, from where the line starts on its middle
   * (the central baseline the renderer sets lines on); null for a line with
   * nothing drawn. Without it, each line's box stands in for its letters.
   */
  bounds?: (
    text: string,
    font: FontSpec,
    sizeMm: number,
    trackingMm: number,
  ) => LetterBounds | null;
  /** The letters of a text that no face draws, when that can be known. */
  lacking?: (text: string, font: FontSpec) => string;
  /**
   * The size of an image layer's file: null when there is no such file,
   * undefined to leave the image unchecked.
   */
  picture?: (
    layer: ImageLayer & { asset: string },
  ) => PictureSize | null | undefined;
}

export interface DesignCheck {
  issues: PrintIssue[];
  /** Each printed text layer's lines, by layer id. */
  layouts: Record<string, TextLayout>;
}

export function textStyleOf(layer: TextLayer, document: DesignDocument) {
  return { ...document.theme.text[layer.style], ...layer.overrides };
}

export function fontSpecOf(
  layer: TextLayer,
  document: DesignDocument,
): FontSpec {
  const style = textStyleOf(layer, document);
  return { family: style.font, weight: style.weight, italic: style.italic };
}

/**
 * Checks a design with its couple's own details, as it prints: lines whose
 * details are empty are left out, with no examples in their place.
 */
export function checkDesign(
  document: DesignDocument,
  fields: Fields,
  options: CheckOptions = {},
): DesignCheck {
  const issues: PrintIssue[] = [];
  const layouts: Record<string, TextLayout> = {};

  const missing = fieldKeysUsed(document).filter(
    (key) => key !== "monogram" && !fields[key]?.trim(),
  );
  if (missing.length > 0)
    issues.push({ kind: "missing-details", fields: missing });

  for (const piece of document.pieces)
    for (const face of faceNames)
      for (const layer of piece[face]?.layers ?? []) {
        if (layer.hidden) continue;
        const at = { piece: piece.id, face, layer: layer.id };
        if (layer.type === "text") {
          const text = resolveText(layer.text, {
            fields,
            occasion: document.occasion,
            language: document.language,
          });
          if (!text.trim()) continue;
          const layout = layoutText({
            text,
            style: textStyleOf(layer, document),
            width: layer.frame.width,
            height: layer.frame.height,
            fit: layer.fit,
            minSize: layer.minSize,
            measure: options.measure,
          });
          layouts[layer.id] = layout;
          if (layout.overflows) issues.push({ kind: "overflow", ...at });
          if (outsideSafeArea(piece, layer, layout, document, options.bounds))
            issues.push({ kind: "outside-safe-area", ...at });
          const font = fontSpecOf(layer, document);
          const lacking = options.lacking?.(text, font) ?? "";
          if (lacking)
            issues.push({ kind: "missing-glyphs", ...at, characters: lacking });
          const unusual = unusualCharacters(text);
          if (unusual)
            issues.push({
              kind: "unusual-characters",
              ...at,
              characters: unusual,
            });
        } else if (layer.type === "image") {
          if (!layer.asset) {
            if (layer.replaceable)
              issues.push({ kind: "missing-photo", ...at });
            continue;
          }
          const picture = options.picture?.({ ...layer, asset: layer.asset });
          if (picture === null)
            issues.push({ kind: "missing-artwork", ...at, asset: layer.asset });
          else if (picture) {
            const dpi = Math.floor(imageResolution(layer, picture));
            if (dpi < PRINT_DPI)
              issues.push({ kind: "low-resolution", ...at, dpi });
          }
        }
      }
  return { issues, layouts };
}

/** The letters of a text that the studio loads no typeface for, once each. */
export function unusualCharacters(text: string): string {
  return [...new Set(text.replace(/\s/g, ""))]
    .filter((letter) => !fontCharacters.includes(letter))
    .join("");
}

/**
 * Whether the couple's words reach past the safe margin: where their letters
 * reach, which a wide frame or a tall line can hide. Jolene's own fixed words
 * are placed by hand and left alone.
 */
function outsideSafeArea(
  piece: Piece,
  layer: TextLayer,
  layout: TextLayout,
  document: DesignDocument,
  boundsOf: CheckOptions["bounds"],
): boolean {
  if (layer.locked || layer.rotation !== 0) return false;
  const style = textStyleOf(layer, document);
  const font = fontSpecOf(layer, document);
  const sizeMm = ptToMm(layout.size);
  const trackingMm = (style.tracking / 1000) * sizeMm;
  const middles = lineMiddles(layout, layer.valign, layer.frame.height);
  const margin = piece.safeMargin - 0.05;
  return layout.lines.some((line, index) => {
    if (!line.text.trim()) return false;
    const start =
      layer.frame.x +
      (layer.align === "left"
        ? 0
        : layer.align === "right"
          ? layer.frame.width - line.width
          : (layer.frame.width - line.width) / 2);
    const middle = layer.frame.y + (middles[index] as number);
    const bounds = boundsOf
      ? boundsOf(line.text, font, sizeMm, trackingMm)
      : {
          left: 0,
          right: line.width,
          top: -layout.lineHeight / 2,
          bottom: layout.lineHeight / 2,
        };
    return (
      bounds !== null &&
      (start + bounds.left < margin ||
        middle + bounds.top < margin ||
        start + bounds.right > piece.width - margin ||
        middle + bounds.bottom > piece.height - margin)
    );
  });
}

/** Where an image goes in its frame, as SVG's preserveAspectRatio puts it. */
export function imagePlacement(layer: ImageLayer, picture: PictureSize) {
  const { width, height } = layer.frame;
  if (layer.fit === "fill") return { x: 0, y: 0, width, height };
  const scale = (layer.fit === "cover" ? Math.max : Math.min)(
    width / picture.width,
    height / picture.height,
  );
  const drawn = {
    width: picture.width * scale,
    height: picture.height * scale,
  };
  return {
    x: (width - drawn.width) / 2,
    y: (height - drawn.height) / 2,
    ...drawn,
  };
}

/** The image's resolution as printed, in dots per inch. */
export function imageResolution(
  layer: ImageLayer,
  picture: PictureSize,
): number {
  const drawn = imagePlacement(layer, picture);
  return Math.min(
    picture.width / (drawn.width / 25.4),
    picture.height / (drawn.height / 25.4),
  );
}
