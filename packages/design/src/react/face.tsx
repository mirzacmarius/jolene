import { type CSSProperties, type ReactNode, useId } from "react";
import { stocks } from "../catalog";
import { resolveColor } from "../color";
import { trimPath } from "../geometry";
import type { DesignDocument, FaceName, Piece } from "../schema";
import { Defs, defIds } from "./defs";
import { LayerView } from "./layers";
import { type RenderContext, svgId } from "./shared";

/** The paper colour of a piece: its own if set, else its stock's. */
export function paperColor(piece: Piece, document: DesignDocument): string {
  return piece.paper
    ? resolveColor(piece.paper, document.theme.palette)
    : stocks[piece.stock].color;
}

export interface PieceSurfaceProps {
  document: DesignDocument;
  piece: Piece;
  face: FaceName;
  context: RenderContext;
  prefix: string;
  /** Draw the bleed instead of clipping to the trim. */
  bleed: boolean;
  /**
   * Leave the paper untextured, for a view that lays its own grain over the
   * printing (the lifelike preview).
   */
  plain?: boolean;
  /** Drawn over the printing, inside the trim. */
  children?: ReactNode;
}

/** One side of a piece, paper and printing, in the piece's millimetres. */
export function PieceSurface({
  document,
  piece,
  face,
  context,
  prefix,
  bleed,
  plain = false,
  children,
}: PieceSurfaceProps) {
  const ids = defIds(prefix);
  const side = piece[face];
  const stock = stocks[piece.stock];
  const paper = paperColor(piece, document);
  const b = bleed ? piece.bleed : 0;
  const clipId = `${prefix}-trim-${piece.id}`;
  const area = {
    x: -b,
    y: -b,
    width: piece.width + 2 * b,
    height: piece.height + 2 * b,
  };
  return (
    <g>
      <clipPath id={clipId}>
        {bleed ? <rect {...area} /> : <path d={trimPath(piece)} />}
      </clipPath>
      <g clipPath={`url(#${clipId})`}>
        <rect
          {...area}
          fill={paper}
          fillOpacity={stock.translucent ? 0.58 : 1}
        />
        {plain ? null : stock.texture === "pearl" ? (
          <rect {...area} fill={`url(#${ids.texture("pearl")})`} />
        ) : stock.texture !== "smooth" ? (
          <rect
            {...area}
            filter={`url(#${ids.texture(stock.texture)})`}
            opacity={stock.texture === "kraft" ? 0.8 : 0.4}
          />
        ) : null}
        {side?.background ? (
          <rect
            {...area}
            fill={resolveColor(side.background, document.theme.palette)}
          />
        ) : null}
        {side?.layers.map((layer) => (
          <LayerView
            key={layer.id}
            layer={layer}
            document={document}
            paper={paper}
            prefix={prefix}
            context={context}
          />
        ))}
        {children}
      </g>
    </g>
  );
}

/** Trim, bleed, safe area and fold, as the editor shows them. */
function Guides({ piece }: { piece: Piece }) {
  const { width: w, height: h, bleed: b, safeMargin: s } = piece;
  const outside = `M${-b} ${-b}H${w + b}V${h + b}H${-b}Z ${trimPath(piece)}`;
  return (
    <g pointerEvents="none">
      <path d={outside} fill="#ffffff" fillOpacity={0.6} fillRule="evenodd" />
      <path
        d={trimPath(piece)}
        fill="none"
        stroke="#c2185b"
        strokeWidth={0.25}
        vectorEffect="non-scaling-stroke"
      />
      {s > 0 ? (
        <rect
          x={s}
          y={s}
          width={w - 2 * s}
          height={h - 2 * s}
          fill="none"
          stroke="#0284c7"
          strokeWidth={0.2}
          strokeDasharray="1.5 1"
          vectorEffect="non-scaling-stroke"
        />
      ) : null}
      {piece.fold ? (
        piece.fold.orientation === "vertical" ? (
          <line
            x1={piece.fold.at}
            y1={-b}
            x2={piece.fold.at}
            y2={h + b}
            stroke="#64748b"
            strokeWidth={0.2}
            strokeDasharray="2 1.5"
            vectorEffect="non-scaling-stroke"
          />
        ) : (
          <line
            x1={-b}
            y1={piece.fold.at}
            x2={w + b}
            y2={piece.fold.at}
            stroke="#64748b"
            strokeWidth={0.2}
            strokeDasharray="2 1.5"
            vectorEffect="non-scaling-stroke"
          />
        )
      ) : null}
    </g>
  );
}

export interface FaceViewProps {
  document: DesignDocument;
  /** The piece's id; the first piece when left out. */
  piece?: string;
  face?: FaceName;
  context: RenderContext;
  /**
   * "screen" shows the finished card, cut to its shape; "print" includes the
   * bleed and is sized in millimetres, for print files.
   */
  mode?: "screen" | "print";
  /** Show the bleed, trim, safe area and fold, as the editor does. */
  guides?: boolean;
  title?: string;
  className?: string;
  style?: CSSProperties;
}

/** One side of one piece, as a standalone SVG. */
export function FaceView({
  document,
  piece: pieceId,
  face = "front",
  context,
  mode = "screen",
  guides = false,
  title,
  className,
  style,
}: FaceViewProps) {
  const prefix = svgId(useId(), "face");
  const piece =
    document.pieces.find((candidate) => candidate.id === pieceId) ??
    (document.pieces[0] as Piece);
  const withBleed = mode === "print" || guides;
  const b = withBleed ? piece.bleed : 0;
  const viewWidth = piece.width + 2 * b;
  const viewHeight = piece.height + 2 * b;
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox={`${-b} ${-b} ${viewWidth} ${viewHeight}`}
      width={mode === "print" ? `${viewWidth}mm` : "100%"}
      height={mode === "print" ? `${viewHeight}mm` : undefined}
      role="img"
      aria-label={title}
      className={className}
      style={
        mode === "print"
          ? style
          : {
              aspectRatio: `${viewWidth} / ${viewHeight}`,
              display: "block",
              ...style,
            }
      }
    >
      {title ? <title>{title}</title> : null}
      <Defs prefix={prefix} />
      <PieceSurface
        document={document}
        piece={piece}
        face={face}
        context={context}
        prefix={prefix}
        bleed={withBleed}
      />
      {guides ? <Guides piece={piece} /> : null}
    </svg>
  );
}
