import {
  type DesignDocument,
  type FaceName,
  type Fields,
  faceNames,
  layoutText,
  type Measure,
  resolveText,
} from "@jolene/design";

/**
 * How the design's words sit in their frames, for the AI designer: the text
 * layers that overflow, shrink to fit or reach past the safe margin. The
 * backend measures with an estimate; the studio, which sends the same report
 * with a rendering, measures with the real fonts. Pure, so both can use it.
 */

export interface TextFit {
  piece: string;
  face: FaceName;
  layer: string;
  /** The size the words are set at, in points, after any shrinking. */
  size: number;
  /** The size the layer's style asks for. */
  styleSize: number;
  /** Still too big for its frame at `size`. */
  overflows: boolean;
  /** The words reach past the piece's safe margin, towards the trim. */
  outsideSafeArea: boolean;
}

export interface LayoutReport {
  /** "estimate" on the backend, "fonts" when measured in the browser. */
  measuredWith: "estimate" | "fonts";
  /** Only the layers worth a look; an empty list means every text fits. */
  layers: TextFit[];
}

/**
 * Lays out every text layer of the faces asked for (every face when left
 * out) as the preview shows it, with examples standing in for empty details.
 */
export function layoutReport(
  document: DesignDocument,
  fields: Fields,
  options: {
    measure?: Measure;
    faces?: { piece: string; face: FaceName }[];
  } = {},
): LayoutReport {
  const layers: TextFit[] = [];
  for (const piece of document.pieces) {
    for (const face of faceNames) {
      const shown =
        !options.faces ||
        options.faces.some(
          (wanted) => wanted.piece === piece.id && wanted.face === face,
        );
      if (!shown) continue;
      for (const layer of piece[face]?.layers ?? []) {
        if (layer.type !== "text" || layer.hidden) continue;
        const text = resolveText(layer.text, {
          fields,
          occasion: document.occasion,
          language: document.language,
        });
        if (!text.trim()) continue;
        const style = {
          ...document.theme.text[layer.style],
          ...layer.overrides,
        };
        const layout = layoutText({
          text,
          style,
          width: layer.frame.width,
          height: layer.frame.height,
          fit: layer.fit,
          minSize: layer.minSize,
          measure: options.measure,
        });
        // Where the words themselves sit, which a wide frame can hide: the
        // template's own fixed text is left alone.
        const { x, y, width, height } = layer.frame;
        const inkWidth = Math.max(0, ...layout.lines.map((line) => line.width));
        const left =
          layer.align === "left"
            ? x
            : layer.align === "right"
              ? x + width - inkWidth
              : x + (width - inkWidth) / 2;
        const top =
          layer.valign === "top"
            ? y
            : layer.valign === "bottom"
              ? y + height - layout.height
              : y + (height - layout.height) / 2;
        const margin = piece.safeMargin - 0.05;
        const outsideSafeArea =
          !layer.locked &&
          layer.rotation === 0 &&
          (left < margin ||
            top < margin ||
            left + inkWidth > piece.width - margin ||
            top + layout.height > piece.height - margin);
        const shrunk = layout.size < style.size - 0.01;
        if (!layout.overflows && !shrunk && !outsideSafeArea) continue;
        layers.push({
          piece: piece.id,
          face,
          layer: layer.id,
          size: Math.round(layout.size * 100) / 100,
          styleSize: style.size,
          overflows: layout.overflows,
          outsideSafeArea,
        });
      }
    }
  }
  return {
    measuredWith: options.measure ? "fonts" : "estimate",
    layers,
  };
}
