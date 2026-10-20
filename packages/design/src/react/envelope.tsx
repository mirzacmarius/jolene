import { type Hex, mix, resolveColor } from "../color";
import { assemblyBounds, type Box } from "../geometry";
import type { DesignDocument, Envelope } from "../schema";
import { grainMm } from "./grain";
import type { RenderContext } from "./shared";

/**
 * The envelope an item is posted in, drawn behind the assembled pieces the
 * way a stationer photographs a suite: lying back up, a little turned, its
 * flap open on the liner when it has one.
 */

/** Room around the pieces inside the envelope, in millimetres. */
const CLEARANCE = 5;

export interface EnvelopeLayout {
  /** The body's size, in millimetres, before turning. */
  width: number;
  height: number;
  /** The body's centre, in the assembly's millimetres. */
  cx: number;
  cy: number;
  /** Degrees clockwise around the centre. */
  rotation: number;
  /** How far the flap reaches from the opening, open or closed. */
  flap: number;
  /** The flap lies open, showing the liner, or closed over the back. */
  open: boolean;
}

/**
 * Where the envelope lies and how big it is: a little larger than the pieces
 * and turned the same way, lying behind them a little turned, so it shows
 * above and to the right of them.
 */
export function envelopeLayout(
  document: Pick<DesignDocument, "pieces" | "envelope">,
): EnvelopeLayout | null {
  const envelope = document.envelope;
  if (!envelope) return null;
  const bounds = assemblyBounds(document);
  const width = bounds.width + 2 * CLEARANCE;
  const height = bounds.height + 2 * CLEARANCE;
  const flap =
    envelope.style === "square-flap"
      ? height * 0.24
      : envelope.style === "pocket"
        ? width * 0.36
        : Math.min(width * 0.5, height * 0.42);
  return {
    width,
    height,
    cx: bounds.x + bounds.width / 2 + width * 0.11,
    cy: bounds.y + bounds.height / 2 - height * 0.07,
    rotation: 4,
    flap,
    open: envelope.liner !== null,
  };
}

/** The box the envelope covers, flap included, ignoring its slight turn. */
export function envelopeBox(layout: EnvelopeLayout): Box {
  const top = layout.cy - layout.height / 2 - (layout.open ? layout.flap : 0);
  // A turned envelope reaches a little further at its corners.
  const slack =
    Math.abs(Math.sin((layout.rotation * Math.PI) / 180)) *
    Math.max(layout.width, layout.height);
  return {
    x: layout.cx - layout.width / 2 - slack / 2,
    y: top - slack / 2,
    width: layout.width + slack,
    height: layout.cy + layout.height / 2 - top + slack,
  };
}

/**
 * The flap's outline from the opening's left end to its right, reaching
 * `depth` above the opening (below it, when `depth` is negative: closed).
 */
function flapPath(style: Envelope["style"], width: number, depth: number) {
  const d = -depth;
  if (style === "square-flap") {
    const r = Math.min(6, Math.abs(d) * 0.3) * Math.sign(d);
    const inset = width * 0.07;
    return `M0 0L${inset} ${d - r}Q${inset} ${d} ${inset + Math.abs(r)} ${d}H${width - inset - Math.abs(r)}Q${width - inset} ${d} ${width - inset} ${d - r}L${width} 0Z`;
  }
  if (style === "pocket") {
    // A rounded flap, like a pocket's.
    return `M0 0C${width * 0.02} ${d * 0.75} ${width * 0.22} ${d} ${width / 2} ${d}C${width * 0.78} ${d} ${width * 0.98} ${d * 0.75} ${width} 0Z`;
  }
  // A pointed flap, its tip softly rounded.
  const tip = Math.min(10, width * 0.06);
  const slope = d / (width / 2);
  return `M0 0L${width / 2 - tip} ${d - tip * slope}Q${width / 2} ${d + Math.sign(d) * tip * 0.15} ${width / 2 + tip} ${d - tip * slope}L${width} 0Z`;
}

/** The same outline drawn smaller, for the liner glued inside the flap. */
function linerPath(style: Envelope["style"], width: number, depth: number) {
  const inset = Math.min(5, width * 0.035);
  const inner = flapPath(style, width - 2 * inset, depth - inset * 1.8);
  return { path: inner, x: inset, y: -inset * 0.4 };
}

export interface EnvelopeViewProps {
  document: DesignDocument;
  layout: EnvelopeLayout;
  context: RenderContext;
  prefix: string;
  /** The smooth paper's grain laid over the envelope, if drawn yet. */
  grain?: string;
}

/** The envelope, back up, in the assembly's millimetres. */
export function EnvelopeView({
  document,
  layout,
  context,
  prefix,
  grain,
}: EnvelopeViewProps) {
  const envelope = document.envelope;
  if (!envelope) return null;
  const { width: w, height: h, flap: depth, open } = layout;
  const id = (name: string) => `${prefix}-envelope-${name}`;
  const paper = envelope.color as Hex;
  const liner = envelope.liner
    ? resolveColor(envelope.liner.color, document.theme.palette)
    : null;
  const linerArt = envelope.liner?.asset
    ? context.assets(envelope.liner.asset)
    : undefined;
  const lit = mix(paper, "#ffffff", 0.05);
  const shade = mix(paper, "#000000", 0.035);
  const deep = mix(paper, "#000000", 0.3);
  // Where the side flaps meet below the opening, and the bottom flap's tip.
  const throat = { x: w / 2, y: h * 0.2 };
  const apex = { x: w / 2, y: h * 0.44 };
  const flap = flapPath(envelope.style, w, depth);
  const inner = linerPath(envelope.style, w, depth);
  const outline = open ? `M0 0H${w}V${h}H0Z ${flap}` : `M0 0H${w}V${h}H0Z`;
  return (
    <g
      transform={`translate(${layout.cx - w / 2} ${layout.cy - h / 2}) rotate(${layout.rotation} ${w / 2} ${h / 2})`}
    >
      <filter
        id={id("shadow")}
        filterUnits="userSpaceOnUse"
        x={-20}
        y={-depth - 20}
        width={w + 50}
        height={h + depth + 50}
        colorInterpolationFilters="sRGB"
      >
        <feGaussianBlur in="SourceAlpha" stdDeviation="3.2" result="soft" />
        <feOffset in="soft" dx="1.6" dy="3" result="softer" />
        <feComponentTransfer in="softer" result="key">
          <feFuncA type="linear" slope="0.2" />
        </feComponentTransfer>
        <feGaussianBlur in="SourceAlpha" stdDeviation="0.35" result="near" />
        <feOffset in="near" dx="0.2" dy="0.4" result="nearer" />
        <feComponentTransfer in="nearer" result="contact">
          <feFuncA type="linear" slope="0.3" />
        </feComponentTransfer>
        <feMerge result="shadow">
          <feMergeNode in="key" />
          <feMergeNode in="contact" />
        </feMerge>
        <feFlood floodColor="#2a231b" />
        <feComposite in2="shadow" operator="in" />
      </filter>
      <linearGradient id={id("light")} x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor="#ffffff" stopOpacity="0.12" />
        <stop offset="0.5" stopColor="#ffffff" stopOpacity="0" />
        <stop offset="1" stopColor="#000000" stopOpacity="0.07" />
      </linearGradient>
      <linearGradient id={id("inside")} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#000000" stopOpacity="0.28" />
        <stop offset="1" stopColor="#000000" stopOpacity="0.05" />
      </linearGradient>
      {linerArt ? (
        <pattern
          id={id("liner-art")}
          patternUnits="userSpaceOnUse"
          x={0}
          y={-depth}
          width={w}
          height={depth + h * 0.25}
        >
          <image
            href={linerArt.url}
            width={w}
            height={depth + h * 0.25}
            preserveAspectRatio="xMidYMid slice"
          />
        </pattern>
      ) : null}
      {grain ? (
        <pattern
          id={id("grain")}
          patternUnits="userSpaceOnUse"
          width={grainMm("smooth")}
          height={grainMm("smooth")}
        >
          <image
            href={grain}
            width={grainMm("smooth")}
            height={grainMm("smooth")}
          />
        </pattern>
      ) : null}
      <clipPath id={id("outline")}>
        <path d={outline} />
      </clipPath>

      <path d={outline} filter={`url(#${id("shadow")})`} />

      {/* Inside the envelope, seen through the opening. */}
      <rect width={w} height={h} fill={liner ?? deep} />
      {linerArt ? (
        <rect width={w} height={h} fill={`url(#${id("liner-art")})`} />
      ) : null}
      <rect width={w} height={h * 0.3} fill={`url(#${id("inside")})`} />

      {/* The back: two side flaps, the bottom flap over them. */}
      <path
        d={`M0 0L${throat.x} ${throat.y}L${apex.x} ${apex.y}L0 ${h}Z`}
        fill={lit}
      />
      <path
        d={`M${w} 0L${throat.x} ${throat.y}L${apex.x} ${apex.y}L${w} ${h}Z`}
        fill={shade}
      />
      <path
        d={`M0 0L${throat.x} ${throat.y}L${w} 0`}
        fill="none"
        stroke="#000000"
        strokeOpacity={0.18}
        strokeWidth={0.35}
      />
      <path
        d={`M-0.2 ${h + 0.2}Q${w * 0.18} ${h * 0.62} ${apex.x} ${apex.y}Q${w * 0.82} ${h * 0.62} ${w + 0.2} ${h + 0.2}Z`}
        fill={paper}
        stroke="#000000"
        strokeOpacity={0.12}
        strokeWidth={0.3}
      />
      <path
        d={`M${w * 0.06} ${h * 0.93}Q${w * 0.2} ${h * 0.66} ${apex.x} ${apex.y + 0.5}`}
        fill="none"
        stroke="#ffffff"
        strokeOpacity={0.35}
        strokeWidth={0.3}
      />

      {open ? (
        <g>
          <path d={flap} fill={lit} />
          {liner ? (
            <g transform={`translate(${inner.x} ${inner.y})`}>
              <path d={inner.path} fill={liner} />
              {linerArt ? (
                <path
                  d={inner.path}
                  fill={`url(#${id("liner-art")})`}
                  transform={`translate(${-inner.x} ${-inner.y})`}
                />
              ) : null}
            </g>
          ) : null}
          {/* The fold: lit along its edge, shadowed just under it. */}
          <line
            x1={0}
            y1={0}
            x2={w}
            y2={0}
            stroke="#000000"
            strokeOpacity={0.16}
            strokeWidth={0.45}
          />
          <line
            x1={0}
            y1={-0.45}
            x2={w}
            y2={-0.45}
            stroke="#ffffff"
            strokeOpacity={0.5}
            strokeWidth={0.3}
          />
        </g>
      ) : (
        <g>
          {/* Closed, the flap lies over the back and shades it a little. */}
          <path
            d={flapPath(envelope.style, w, -depth)}
            fill="#000000"
            fillOpacity={0.1}
            transform="translate(0.35 0.7)"
          />
          <path
            d={flapPath(envelope.style, w, -depth)}
            fill={lit}
            stroke="#000000"
            strokeOpacity={0.1}
            strokeWidth={0.25}
          />
        </g>
      )}

      <g clipPath={`url(#${id("outline")})`}>
        <path d={outline} fill={`url(#${id("light")})`} />
        {grain ? (
          <path d={outline} fill={`url(#${id("grain")})`} opacity={0.8} />
        ) : null}
      </g>
    </g>
  );
}
