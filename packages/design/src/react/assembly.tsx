import { type CSSProperties, useId } from "react";
import { waxColors } from "../catalog";
import { type Hex, mix } from "../color";
import { resolveText } from "../fields";
import { assemblyBounds, type Box, trimPath } from "../geometry";
import type { Accessory, DesignDocument, Piece } from "../schema";
import { Defs, defIds } from "./defs";
import { PieceSurface } from "./face";
import { fontStack, type RenderContext, svgId } from "./shared";

type WaxSealSpec = Extract<Accessory, { kind: "wax-seal" }>;
type RibbonSpec = Extract<Accessory, { kind: "ribbon" }>;

/** A wax seal: an uneven pool of wax with initials pressed into it. */
function WaxSeal({
  seal,
  prefix,
  initials,
}: {
  seal: WaxSealSpec;
  prefix: string;
  initials: string;
}) {
  const r = seal.diameter / 2;
  const wax = waxColors[seal.color].color as Hex;
  const light = mix(wax, "#ffffff", 0.35);
  const dark = mix(wax, "#000000", 0.35);
  const gradientId = `${prefix}-wax-${seal.id}`;
  const pressId = `${prefix}-press-${seal.id}`;
  const points = Array.from({ length: 28 }, (_, k) => {
    const angle = (k / 28) * Math.PI * 2;
    const wobble = 1 + 0.045 * Math.sin(k * 2.7 + 1) + 0.03 * Math.cos(k * 5.3);
    return `${(Math.cos(angle) * r * wobble).toFixed(2)} ${(Math.sin(angle) * r * wobble).toFixed(2)}`;
  });
  return (
    <g
      transform={`translate(${seal.x} ${seal.y})`}
      filter={`url(#${defIds(prefix).shadow})`}
    >
      <radialGradient id={gradientId} cx="0.38" cy="0.32" r="0.75">
        <stop offset="0" stopColor={light} />
        <stop offset="0.55" stopColor={wax} />
        <stop offset="1" stopColor={dark} />
      </radialGradient>
      <radialGradient id={pressId} cx="0.6" cy="0.68" r="0.7">
        <stop offset="0" stopColor={mix(wax, "#ffffff", 0.12)} />
        <stop offset="0.8" stopColor={wax} />
        <stop offset="1" stopColor={dark} />
      </radialGradient>
      <path d={`M${points.join("L")}Z`} fill={`url(#${gradientId})`} />
      <circle r={r * 0.7} fill={`url(#${pressId})`} />
      <circle
        r={r * 0.7}
        fill="none"
        stroke={dark}
        strokeWidth={0.35}
        opacity={0.6}
      />
      <circle
        r={r * 0.7 - 0.4}
        fill="none"
        stroke={light}
        strokeWidth={0.25}
        opacity={0.5}
      />
      {initials ? (
        <g
          fontFamily={fontStack("Cormorant Garamond")}
          fontStyle="italic"
          fontWeight={600}
          fontSize={r * (initials.length > 3 ? 0.42 : 0.6)}
          textAnchor="middle"
          dominantBaseline="central"
        >
          <text x={0.18} y={0.18} fill={light} opacity={0.7}>
            {initials}
          </text>
          <text fill={dark}>{initials}</text>
        </g>
      ) : null}
    </g>
  );
}

const ribbonFinish = {
  satin: { shine: 0.45, depth: 0.3 },
  chiffon: { shine: 0.25, depth: 0.15 },
  velvet: { shine: 0.12, depth: 0.45 },
  lace: { shine: 0.2, depth: 0.1 },
  twine: { shine: 0.1, depth: 0.25 },
} as const;

/** A ribbon tied round the whole assembly. */
function Ribbon({
  ribbon,
  bounds,
  prefix,
}: {
  ribbon: RibbonSpec;
  bounds: Box;
  prefix: string;
}) {
  const id = `${prefix}-ribbon-${ribbon.id}`;
  const finish = ribbonFinish[ribbon.material];
  const color = ribbon.color as Hex;
  const horizontal = ribbon.orientation === "horizontal";
  const band = horizontal
    ? {
        x: bounds.x - 1,
        y: bounds.y + ribbon.offset - ribbon.width / 2,
        width: bounds.width + 2,
        height: ribbon.width,
      }
    : {
        x: bounds.x + ribbon.offset - ribbon.width / 2,
        y: bounds.y - 1,
        width: ribbon.width,
        height: bounds.height + 2,
      };
  const centre = {
    x: horizontal ? bounds.x + bounds.width / 2 : band.x + band.width / 2,
    y: horizontal ? band.y + band.height / 2 : bounds.y + bounds.height / 2,
  };
  const w = ribbon.width;
  return (
    <g filter={`url(#${defIds(prefix).shadow})`}>
      <linearGradient
        id={id}
        x1="0"
        y1="0"
        x2={horizontal ? "0" : "1"}
        y2={horizontal ? "1" : "0"}
      >
        <stop offset="0" stopColor={mix(color, "#000000", finish.depth)} />
        <stop offset="0.45" stopColor={mix(color, "#ffffff", finish.shine)} />
        <stop offset="1" stopColor={mix(color, "#000000", finish.depth)} />
      </linearGradient>
      {ribbon.material === "twine" ? (
        <g
          stroke={`url(#${id})`}
          strokeWidth={Math.min(1.2, w / 3)}
          fill="none"
        >
          {[-0.6, 0.6].map((shift) => (
            <line
              key={shift}
              x1={horizontal ? band.x : centre.x + shift}
              y1={horizontal ? centre.y + shift : band.y}
              x2={horizontal ? band.x + band.width : centre.x + shift}
              y2={horizontal ? centre.y + shift : band.y + band.height}
            />
          ))}
        </g>
      ) : (
        <rect
          {...band}
          fill={`url(#${id})`}
          opacity={
            ribbon.material === "lace" || ribbon.material === "chiffon"
              ? 0.82
              : 1
          }
        />
      )}
      {ribbon.bow ? (
        <g
          transform={`translate(${centre.x} ${centre.y})`}
          fill={`url(#${id})`}
        >
          <path
            d={`M0 0C${-w * 1.2} ${-w * 1.4} ${-w * 2.6} ${-w * 0.6} ${-w * 2.2} ${w * 0.2}C${-w * 1.9} ${w * 0.9} ${-w * 0.8} ${w * 0.5} 0 0Z`}
          />
          <path
            d={`M0 0C${w * 1.2} ${-w * 1.4} ${w * 2.6} ${-w * 0.6} ${w * 2.2} ${w * 0.2}C${w * 1.9} ${w * 0.9} ${w * 0.8} ${w * 0.5} 0 0Z`}
          />
          <path
            d={`M${-w * 0.2} ${w * 0.2}L${-w * 1.3} ${w * 2.6}L${-w * 0.7} ${w * 2.4}L0 ${w * 0.4}Z`}
          />
          <path
            d={`M${w * 0.2} ${w * 0.2}L${w * 1.2} ${w * 2.7}L${w * 0.6} ${w * 2.5}L0 ${w * 0.4}Z`}
          />
          <ellipse rx={w * 0.45} ry={w * 0.42} />
        </g>
      ) : null}
    </g>
  );
}

/** Moves a piece from its own millimetres to its place in the assembly. */
export function placeTransform(piece: Piece): string {
  return `translate(${piece.place.x} ${piece.place.y})${
    piece.place.rotation
      ? ` rotate(${piece.place.rotation} ${piece.width / 2} ${piece.height / 2})`
      : ""
  }`;
}

export interface AssemblyViewProps {
  document: DesignDocument;
  context: RenderContext;
  /** Space around the item, in millimetres, for its shadow and seals. */
  margin?: number;
  title?: string;
  className?: string;
  style?: CSSProperties;
}

/**
 * The finished item as it arrives: every piece in its place, vellum over the
 * card, ribbons tied and seals pressed.
 */
export function AssemblyView({
  document,
  context,
  margin = 8,
  title,
  className,
  style,
}: AssemblyViewProps) {
  const prefix = svgId(useId(), "assembly");
  const ids = defIds(prefix);
  const bounds = assemblyBounds(document);
  const view = {
    x: bounds.x - margin,
    y: bounds.y - margin,
    width: bounds.width + 2 * margin,
    height: bounds.height + 2 * margin,
  };
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox={`${view.x} ${view.y} ${view.width} ${view.height}`}
      width="100%"
      role="img"
      aria-label={title}
      className={className}
      style={{
        aspectRatio: `${view.width} / ${view.height}`,
        display: "block",
        ...style,
      }}
    >
      {title ? <title>{title}</title> : null}
      <Defs prefix={prefix} />
      {document.pieces.map((piece) => (
        <g key={piece.id} transform={placeTransform(piece)}>
          <path
            d={trimPath(piece)}
            fill="#ffffff"
            fillOpacity={piece.role === "overlay" ? 0 : 1}
            filter={
              piece.role === "overlay" ? undefined : `url(#${ids.shadow})`
            }
          />
          <PieceSurface
            document={document}
            piece={piece}
            face="front"
            context={context}
            prefix={prefix}
            bleed={false}
          />
        </g>
      ))}
      {document.accessories.map((accessory) =>
        accessory.kind === "ribbon" ? (
          <Ribbon
            key={accessory.id}
            ribbon={accessory}
            bounds={bounds}
            prefix={prefix}
          />
        ) : (
          <WaxSeal
            key={accessory.id}
            seal={accessory}
            prefix={prefix}
            initials={
              accessory.motif.kind === "initials"
                ? resolveText(accessory.motif.text, {
                    fields: context.fields,
                    occasion: document.occasion,
                    language: document.language,
                  })
                : ""
            }
          />
        ),
      )}
    </svg>
  );
}
