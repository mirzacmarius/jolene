import type { DesignDocument, Piece } from "./schema";

/**
 * SVG path data for a piece's finished edge (its die line), in the piece's own
 * millimetres. The same path clips the screen preview and cuts the paper.
 */
export function trimPath(
  piece: Pick<Piece, "width" | "height" | "shape">,
): string {
  const { width: w, height: h, shape } = piece;
  switch (shape.kind) {
    case "rect": {
      const r = Math.min(shape.radius, w / 2, h / 2);
      if (r === 0) return `M0 0H${w}V${h}H0Z`;
      return [
        `M${r} 0H${w - r}`,
        `A${r} ${r} 0 0 1 ${w} ${r}V${h - r}`,
        `A${r} ${r} 0 0 1 ${w - r} ${h}H${r}`,
        `A${r} ${r} 0 0 1 0 ${h - r}V${r}`,
        `A${r} ${r} 0 0 1 ${r} 0Z`,
      ].join("");
    }
    case "arch": {
      const r = Math.min(w / 2, h);
      return `M0 ${h}V${r}A${r} ${r} 0 0 1 ${w} ${r}V${h}Z`;
    }
    case "scallop":
      return scallopPath(w, h, shape.count);
    case "die":
      return shape.path;
  }
}

/**
 * Half-round scallops all the way round, `count` along the shorter edge. The
 * scallops reach the trim size; between them the edge dips inwards.
 */
function scallopPath(w: number, h: number, count: number): string {
  const inset = Math.min(w, h) / (2 * count + 2);
  const innerW = w - 2 * inset;
  const innerH = h - 2 * inset;
  const acrossW = Math.max(1, Math.round(innerW / (2 * inset)));
  const acrossH = Math.max(1, Math.round(innerH / (2 * inset)));
  const stepW = innerW / acrossW;
  const stepH = innerH / acrossH;
  const parts = [`M${inset} ${inset}`];
  for (let i = 1; i <= acrossW; i++)
    parts.push(`A${stepW / 2} ${inset} 0 0 1 ${inset + i * stepW} ${inset}`);
  for (let i = 1; i <= acrossH; i++)
    parts.push(
      `A${inset} ${stepH / 2} 0 0 1 ${w - inset} ${inset + i * stepH}`,
    );
  for (let i = 1; i <= acrossW; i++)
    parts.push(
      `A${stepW / 2} ${inset} 0 0 1 ${w - inset - i * stepW} ${h - inset}`,
    );
  for (let i = 1; i <= acrossH; i++)
    parts.push(
      `A${inset} ${stepH / 2} 0 0 1 ${inset} ${h - inset - i * stepH}`,
    );
  parts.push("Z");
  return parts.join("");
}

export interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** The area the assembled pieces cover, ignoring their rotation. */
export function assemblyBounds(document: Pick<DesignDocument, "pieces">): Box {
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  for (const piece of document.pieces) {
    minX = Math.min(minX, piece.place.x);
    minY = Math.min(minY, piece.place.y);
    maxX = Math.max(maxX, piece.place.x + piece.width);
    maxY = Math.max(maxY, piece.place.y + piece.height);
  }
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}
