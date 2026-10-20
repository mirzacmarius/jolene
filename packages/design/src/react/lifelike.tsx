import { type CSSProperties, Fragment, type ReactNode, useId } from "react";
import { type Ink, paperTextures, stocks } from "../catalog";
import { type Hex, mix, resolveColor } from "../color";
import { resolveText } from "../fields";
import { assemblyBounds, type Box, trimPath } from "../geometry";
import type {
  Accessory,
  DesignDocument,
  FaceName,
  Layer,
  Piece,
} from "../schema";
import { placeTransform } from "./assembly";
import { defIds } from "./defs";
import { EnvelopeView, envelopeBox, envelopeLayout } from "./envelope";
import { PieceSurface, paperColor } from "./face";
import { type GrainKind, grainMm, useGrains } from "./grain";
import { LayerView } from "./layers";
import {
  FOLLOW_LIGHT,
  type FoilInk,
  foilTones,
  followLight,
  isFoil,
  pearlSheen,
  type SheenStop,
  stockThickness,
} from "./materials";
import {
  LifelikeRibbon,
  RibbonCover,
  RibbonSheen,
  ribbonBox,
  ribbonShines,
} from "./ribbon";
import { type RenderContext, svgId } from "./shared";
import { LifelikeWaxSeal, SealGlint, sealOutline } from "./wax-seal";

/**
 * The lifelike preview: a design as a photograph of the printed suite lying
 * on a table. Paper shows its grain and thickness and casts a soft shadow,
 * foil and spot UV catch the light where the pointer is, vellum frosts what
 * lies under it, and the envelope lies behind. It reads the same document as
 * every other view and draws nothing the print file doesn't: the plain
 * renderer (FaceView, AssemblyView) stays exact for proofs and print.
 *
 * Each view is two SVGs, one over the other. The first holds all that stays
 * still and is drawn once. The second holds only what moves with the light:
 * foil's glint, spot UV's gloss, pearl and vellum's sheen, satin's shine and
 * the glint on the wax, each hidden where something lies over it. The page
 * moves the light on the second alone (moveLight), which repaints just that
 * layer: the first SVG, with its shadows and grain, costs too much to repaint
 * as the pointer moves.
 */

type Seal = Extract<Accessory, { kind: "wax-seal" }>;
type Ribbon = Extract<Accessory, { kind: "ribbon" }>;

/** Marks the SVG of a lifelike view that moves with the light. */
const LIGHT_LAYER = "data-lifelike-light";

/**
 * Moves the light over every lifelike view inside `container`, at once: from
 * -1 at the left or top to 1 at the right or bottom, 0 0 in the middle; the
 * page eases it from frame to frame. Only what moves with the light changes,
 * each by a transform of its own, so only the views' light layers repaint.
 */
export function moveLight(container: ParentNode, x: number, y: number) {
  for (const element of container.querySelectorAll<SVGElement>(
    `[${LIGHT_LAYER}] [${FOLLOW_LIGHT}]`,
  )) {
    const [across = 0, down = 0] = (element.getAttribute(FOLLOW_LIGHT) ?? "")
      .split(" ")
      .map(Number);
    element.style.transform = `translate(${(x * across).toFixed(4)}px, ${(y * down).toFixed(4)}px)`;
  }
}

const foils = [
  "foil-gold",
  "foil-silver",
  "foil-rose-gold",
  "foil-copper",
] as const satisfies readonly FoilInk[];

/** Ids of the lifelike view's own definitions, scoped like defIds. */
const lifelikeIds = (prefix: string) => ({
  grain: (kind: GrainKind) => `${prefix}-grain-${kind}`,
  light: `${prefix}-light`,
  bevel: `${prefix}-bevel`,
  pearl: (piece: string) => `${prefix}-pearl-${piece}`,
  vellum: `${prefix}-vellum-sheen`,
  /**
   * Foil layers are drawn again in the light layer under this prefix, whose
   * foils are their moving glint.
   */
  glint: `${prefix}-glint`,
  /**
   * Spot UV is drawn again in the light layer, as if in silver foil, under
   * this prefix, whose silver is a clear gloss: the layer's own shapes,
   * catching the light.
   */
  gloss: `${prefix}-gloss`,
  trim: (piece: string) => `${prefix}-trim-${piece}`,
  cover: (name: string) => `${prefix}-cover-${name}`,
});

/**
 * Foil as polished metal: bands of light and shade across each shape. Each
 * shape shows the middle third of the bands: the metal's middle and dark
 * tones, so pale foil still reads on pale paper, with one soft light band.
 * The glint over it moves with the light (FoilGlint).
 */
function FoilMetal({ id, ink }: { id: string; ink: FoilInk }) {
  const tone = foilTones(ink);
  const stops: [number, Hex][] = [
    [0, tone.light],
    [0.1, tone.mid],
    [0.2, tone.dark],
    [0.3, tone.mid],
    [0.38, tone.dark],
    [0.46, tone.mid],
    [0.52, tone.light],
    [0.57, tone.mid],
    [0.64, tone.dark],
    [0.74, tone.deep],
    [0.86, tone.mid],
    [1, tone.light],
  ];
  return (
    <>
      <linearGradient id={`${id}-metal`} x1="0" y1="0" x2="1" y2="0.55">
        {stops.map(([offset, color]) => (
          <stop key={offset} offset={offset} stopColor={color} />
        ))}
      </linearGradient>
      <pattern
        id={id}
        patternContentUnits="objectBoundingBox"
        width="1"
        height="1"
      >
        <rect x="-1" y="-1" width="3" height="3" fill={`url(#${id}-metal)`} />
      </pattern>
    </>
  );
}

/**
 * Foil's glint: a bright band with a little shade after it, sliding across
 * each shape as the light moves; clear elsewhere, over the metal. It stays
 * short of the paper's own white, so thin foiled type never fades into a
 * pale sheet where the light catches it.
 */
function FoilGlint({ id, ink }: { id: string; ink: FoilInk }) {
  const { glint, deep } = foilTones(ink);
  const stops: [number, Hex, number][] = [
    [0, glint, 0],
    [0.38, glint, 0],
    [0.43, glint, 0.4],
    [0.46, glint, 0.62],
    [0.49, glint, 0.4],
    [0.54, glint, 0],
    [0.6, deep, 0.22],
    [0.68, deep, 0],
    [1, deep, 0],
  ];
  return (
    <>
      <linearGradient id={`${id}-band`} x1="0" y1="0" x2="1" y2="0.55">
        {stops.map(([offset, color, opacity]) => (
          <stop
            key={offset}
            offset={offset}
            stopColor={color}
            stopOpacity={opacity}
          />
        ))}
      </linearGradient>
      <pattern
        id={id}
        patternContentUnits="objectBoundingBox"
        width="1"
        height="1"
      >
        <rect
          x="-1"
          y="-1"
          width="3"
          height="3"
          fill={`url(#${id}-band)`}
          {...followLight(-0.6)}
        />
      </pattern>
    </>
  );
}

/** Spot UV: a clear gloss that deepens the print and catches the light. */
function GlossPaint({ id }: { id: string }) {
  return (
    <>
      <linearGradient id={`${id}-shine`} x1="0" y1="0" x2="1" y2="0.5">
        <stop offset="0" stopColor="#000000" stopOpacity="0.08" />
        <stop offset="0.4" stopColor="#000000" stopOpacity="0.08" />
        <stop offset="0.47" stopColor="#ffffff" stopOpacity="0.45" />
        <stop offset="0.5" stopColor="#ffffff" stopOpacity="0.6" />
        <stop offset="0.55" stopColor="#ffffff" stopOpacity="0.12" />
        <stop offset="0.62" stopColor="#000000" stopOpacity="0.08" />
        <stop offset="1" stopColor="#000000" stopOpacity="0.08" />
      </linearGradient>
      <pattern
        id={id}
        patternContentUnits="objectBoundingBox"
        width="1"
        height="1"
      >
        <rect
          x="-1"
          y="-1"
          width="3"
          height="3"
          fill={`url(#${id}-shine)`}
          {...followLight(-0.6)}
        />
      </pattern>
    </>
  );
}

/**
 * A soft sheen across a whole sheet, sliding with the light: pearlescent
 * card's shimmer of pale colour, vellum's faint gloss.
 */
function Sheen({ id, stops }: { id: string; stops: SheenStop[] }) {
  return (
    <>
      <linearGradient id={`${id}-bands`} x1="0" y1="0" x2="1" y2="0.8">
        {stops.map(([offset, color, opacity]) => (
          <stop
            key={offset}
            offset={offset}
            stopColor={color}
            stopOpacity={opacity}
          />
        ))}
      </linearGradient>
      <pattern
        id={id}
        patternContentUnits="objectBoundingBox"
        width="1"
        height="1"
      >
        <rect
          x="-1"
          y="-1"
          width="3"
          height="3"
          fill={`url(#${id}-bands)`}
          {...followLight(-0.35)}
        />
      </pattern>
    </>
  );
}

/**
 * Embossing and debossing lit from the top left: a raised shape bright along
 * its upper edges and shaded below, casting a hairline shadow; a pressed one
 * the other way round.
 */
function ReliefFilters({ emboss, deboss }: { emboss: string; deboss: string }) {
  return (
    <>
      <filter
        id={emboss}
        x="-10%"
        y="-10%"
        width="120%"
        height="120%"
        colorInterpolationFilters="sRGB"
      >
        <feGaussianBlur in="SourceAlpha" stdDeviation="0.1" result="soft" />
        <feOffset in="soft" dx="0.22" dy="0.22" result="down" />
        <feComposite in="soft" in2="down" operator="out" result="upper" />
        <feFlood floodColor="#ffffff" floodOpacity="0.9" />
        <feComposite in2="upper" operator="in" result="lit" />
        <feOffset in="soft" dx="-0.22" dy="-0.22" result="up" />
        <feComposite in="soft" in2="up" operator="out" result="lower" />
        <feFlood floodColor="#3b3026" floodOpacity="0.32" />
        <feComposite in2="lower" operator="in" result="shaded" />
        <feOffset in="soft" dx="0.2" dy="0.3" result="cast" />
        <feComposite in="cast" in2="SourceAlpha" operator="out" />
        <feGaussianBlur stdDeviation="0.12" result="castSoft" />
        <feFlood floodColor="#3b3026" floodOpacity="0.28" />
        <feComposite in2="castSoft" operator="in" result="shadow" />
        <feMerge>
          <feMergeNode in="shadow" />
          <feMergeNode in="SourceGraphic" />
          <feMergeNode in="shaded" />
          <feMergeNode in="lit" />
        </feMerge>
      </filter>
      <filter
        id={deboss}
        x="-10%"
        y="-10%"
        width="120%"
        height="120%"
        colorInterpolationFilters="sRGB"
      >
        <feGaussianBlur in="SourceAlpha" stdDeviation="0.1" result="soft" />
        <feOffset in="soft" dx="0.24" dy="0.24" result="down" />
        <feComposite in="soft" in2="down" operator="out" result="upper" />
        <feFlood floodColor="#3b3026" floodOpacity="0.4" />
        <feComposite in2="upper" operator="in" result="shaded" />
        <feOffset in="soft" dx="-0.2" dy="-0.2" result="up" />
        <feComposite in="soft" in2="up" operator="out" result="lower" />
        <feFlood floodColor="#ffffff" floodOpacity="0.8" />
        <feComposite in2="lower" operator="in" result="lit" />
        <feFlood floodColor="#3b3026" floodOpacity="0.05" />
        <feComposite in2="SourceAlpha" operator="in" result="floor" />
        <feMerge>
          <feMergeNode in="SourceGraphic" />
          <feMergeNode in="floor" />
          <feMergeNode in="shaded" />
          <feMergeNode in="lit" />
        </feMerge>
      </filter>
    </>
  );
}

function LifelikeDefs({
  prefix,
  grains,
}: {
  prefix: string;
  grains: (kind: GrainKind) => string | undefined;
}) {
  const ids = defIds(prefix);
  const own = lifelikeIds(prefix);
  return (
    <defs>
      {foils.map((ink) => (
        <FoilMetal key={ink} id={ids.ink(ink)} ink={ink} />
      ))}
      <ReliefFilters emboss={ids.emboss} deboss={ids.deboss} />
      {paperTextures.map((kind) => {
        const url = grains(kind);
        const mm = grainMm(kind);
        return url ? (
          <pattern
            key={kind}
            id={own.grain(kind)}
            patternUnits="userSpaceOnUse"
            width={mm}
            height={mm}
          >
            <image href={url} width={mm} height={mm} />
          </pattern>
        ) : null;
      })}
      {/* Daylight from the top left, falling off across each sheet. */}
      <linearGradient id={own.light} x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor="#ffffff" stopOpacity="0.09" />
        <stop offset="0.5" stopColor="#ffffff" stopOpacity="0" />
        <stop offset="1" stopColor="#000000" stopOpacity="0.05" />
      </linearGradient>
      {/* The cut edge: lit along the top and left, shaded along the rest. */}
      <linearGradient id={own.bevel} x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor="#ffffff" stopOpacity="0.85" />
        <stop offset="0.45" stopColor="#ffffff" stopOpacity="0.1" />
        <stop offset="0.55" stopColor="#000000" stopOpacity="0.04" />
        <stop offset="1" stopColor="#000000" stopOpacity="0.22" />
      </linearGradient>
    </defs>
  );
}

/** The light layer's paints: foil's glint, gloss, and the sheens. */
function LightDefs({ prefix }: { prefix: string }) {
  const own = lifelikeIds(prefix);
  const glints = defIds(own.glint);
  return (
    <defs>
      {foils.map((ink) => (
        <FoilGlint key={ink} id={glints.ink(ink)} ink={ink} />
      ))}
      <GlossPaint id={defIds(own.gloss).ink("foil-silver")} />
      <Sheen
        id={own.vellum}
        stops={[
          [0, "#ffffff", 0],
          [0.4, "#ffffff", 0],
          [0.48, "#ffffff", 0.2],
          [0.56, "#ffffff", 0],
          [1, "#ffffff", 0],
        ]}
      />
    </defs>
  );
}

interface PieceProps {
  document: DesignDocument;
  piece: Piece;
  face: FaceName;
  context: RenderContext;
  prefix: string;
  grains: (kind: GrainKind) => string | undefined;
}

/**
 * The shadow a sheet casts on what lies under it: dark where it touches,
 * soft further out. Vellum, thin and translucent, casts hardly any.
 */
function PieceShadow({ piece, prefix }: { piece: Piece; prefix: string }) {
  const id = `${prefix}-shadow-${piece.id}`;
  const thickness = stockThickness(piece.stock);
  const weight = stocks[piece.stock].translucent ? 0.3 : 1;
  const layers = [
    { blur: 6, dx: 2.4, dy: 5, opacity: 0.1 },
    { blur: 1.8, dx: 0.8, dy: 1.7, opacity: 0.2 },
    { blur: 0.35, dx: 0.15, dy: 0.35, opacity: 0.22 + thickness * 0.3 },
  ];
  return (
    <>
      <filter
        id={id}
        filterUnits="userSpaceOnUse"
        x={-14}
        y={-14}
        width={piece.width + 36}
        height={piece.height + 40}
        colorInterpolationFilters="sRGB"
      >
        {layers.map((layer, index) => (
          <Fragment key={layer.blur}>
            <feGaussianBlur in="SourceAlpha" stdDeviation={layer.blur} />
            <feOffset dx={layer.dx} dy={layer.dy} />
            <feComponentTransfer result={`shadow${index}`}>
              <feFuncA type="linear" slope={layer.opacity * weight} />
            </feComponentTransfer>
          </Fragment>
        ))}
        <feMerge result="shadow">
          {layers.map((layer, index) => (
            <feMergeNode key={layer.blur} in={`shadow${index}`} />
          ))}
        </feMerge>
        <feFlood floodColor="#2a2118" />
        <feComposite in2="shadow" operator="in" />
      </filter>
      <path d={trimPath(piece)} filter={`url(#${id})`} />
    </>
  );
}

/**
 * Over the printing: the paper's grain, the fall of the light, and the cut
 * edge catching it.
 */
function PieceFinish({ piece, prefix, grains }: PieceProps) {
  const own = lifelikeIds(prefix);
  const stock = stocks[piece.stock];
  const area = { x: 0, y: 0, width: piece.width, height: piece.height };
  const grain = grains(stock.texture);
  return (
    <>
      {grain ? (
        <rect {...area} fill={`url(#${own.grain(stock.texture)})`} />
      ) : null}
      <rect {...area} fill={`url(#${own.light})`} />
      <path
        d={trimPath(piece)}
        fill="none"
        stroke={`url(#${own.bevel})`}
        strokeWidth={stock.translucent ? 0.3 : 0.5}
      />
    </>
  );
}

/** Whether a layer is printed in its ink: images only when tinted. */
function inked(layer: Layer, context: RenderContext) {
  if (layer.type !== "image") return true;
  return Boolean(
    layer.tint && layer.asset && context.assets(layer.asset)?.recolorable,
  );
}

/** What on one side of a sheet catches the light as it moves. */
function shine(piece: Piece, face: FaceName, context: RenderContext) {
  const stock = stocks[piece.stock];
  const layers = (piece[face]?.layers ?? []).filter(
    (layer) => !layer.hidden && inked(layer, context),
  );
  const foiled = layers.filter((layer) => isFoil(layer.ink));
  const glossy = layers.filter((layer) => layer.ink === "spot-uv");
  const sheen =
    stock.texture === "pearl"
      ? ("pearl" as const)
      : stock.translucent
        ? ("vellum" as const)
        : null;
  return foiled.length || glossy.length || sheen
    ? { foiled, glossy, sheen }
    : null;
}

/**
 * The light on one side of a sheet: pearl's shimmer or vellum's sheen
 * across it, foil's glint and spot UV's gloss on their shapes.
 */
function PieceLight({
  document,
  piece,
  face,
  context,
  prefix,
}: Omit<PieceProps, "grains">) {
  const own = lifelikeIds(prefix);
  const lit = shine(piece, face, context);
  if (!lit) return null;
  const paper = paperColor(piece, document);
  // Pearl's sheen takes the colour the card shows, so each sheet has its own.
  const background = piece[face]?.background;
  const shows = background
    ? resolveColor(background, document.theme.palette)
    : paper;
  const sheen =
    lit.sheen === "pearl"
      ? own.pearl(piece.id)
      : lit.sheen === "vellum"
        ? own.vellum
        : null;
  return (
    <>
      <clipPath id={own.trim(piece.id)}>
        <path d={trimPath(piece)} />
      </clipPath>
      {lit.sheen === "pearl" ? (
        <defs>
          <Sheen id={own.pearl(piece.id)} stops={pearlSheen(shows as Hex)} />
        </defs>
      ) : null}
      <g clipPath={`url(#${own.trim(piece.id)})`}>
        {sheen ? (
          <rect
            width={piece.width}
            height={piece.height}
            fill={`url(#${sheen})`}
          />
        ) : null}
        {lit.foiled.map((layer) => (
          <LayerView
            key={layer.id}
            layer={layer}
            document={document}
            paper={paper}
            prefix={own.glint}
            context={context}
          />
        ))}
        {lit.glossy.map((layer) => (
          <LayerView
            key={layer.id}
            layer={{ ...layer, ink: "foil-silver" satisfies Ink }}
            document={document}
            paper={paper}
            prefix={own.gloss}
            context={context}
          />
        ))}
      </g>
    </>
  );
}

/** One sheet as it lies: its shadow, its cut edge, its face and finish. */
function LifelikePiece(props: PieceProps) {
  const { document, piece, face, context, prefix } = props;
  const thickness = stockThickness(piece.stock);
  const translucent = stocks[piece.stock].translucent;
  // The edge shows the paper itself, whatever is printed on its face.
  const edge = mix(
    paperColor(piece, document) as Hex,
    "#2a2118",
    translucent ? 0.06 : 0.24,
  );
  return (
    <>
      <PieceShadow piece={piece} prefix={prefix} />
      <path
        d={trimPath(piece)}
        fill={edge}
        fillOpacity={translucent ? 0.5 : 1}
        transform={`translate(${thickness * 0.45} ${thickness})`}
      />
      <PieceSurface
        document={document}
        piece={piece}
        face={face}
        context={context}
        prefix={prefix}
        bleed={false}
        plain
      >
        <PieceFinish {...props} />
      </PieceSurface>
    </>
  );
}

/** The box a placed piece covers in the assembly, turned or not. */
function placedBox(piece: Piece): Box {
  const angle = (piece.place.rotation * Math.PI) / 180;
  const cos = Math.abs(Math.cos(angle));
  const sin = Math.abs(Math.sin(angle));
  const width = piece.width * cos + piece.height * sin;
  const height = piece.width * sin + piece.height * cos;
  return {
    x: piece.place.x + (piece.width - width) / 2,
    y: piece.place.y + (piece.height - height) / 2,
    width,
    height,
  };
}

/**
 * What lies under a sheet of vellum, softened as the vellum diffuses it;
 * the vellum, drawn over this, adds its milky veil.
 */
function Frost({
  piece,
  below,
  prefix,
}: {
  piece: Piece;
  below: string;
  prefix: string;
}) {
  const id = `${prefix}-frost-${piece.id}`;
  const box = placedBox(piece);
  return (
    <>
      <clipPath id={`${id}-clip`}>
        <path d={trimPath(piece)} transform={placeTransform(piece)} />
      </clipPath>
      <filter
        id={id}
        filterUnits="userSpaceOnUse"
        x={box.x - 2}
        y={box.y - 2}
        width={box.width + 4}
        height={box.height + 4}
      >
        <feGaussianBlur stdDeviation="0.5" />
      </filter>
      <g clipPath={`url(#${id}-clip)`}>
        <use href={`#${below}`} filter={`url(#${id})`} />
      </g>
    </>
  );
}

export type LifelikeView =
  | { kind: "assembly" }
  | { kind: "face"; piece?: string };

const union = (a: Box, b: Box): Box => {
  const x = Math.min(a.x, b.x);
  const y = Math.min(a.y, b.y);
  return {
    x,
    y,
    width: Math.max(a.x + a.width, b.x + b.width) - x,
    height: Math.max(a.y + a.height, b.y + b.height) - y,
  };
};

/**
 * The part of the table a lifelike view frames, in millimetres: the pieces,
 * the envelope behind them, the seals and bows on them, and a little room.
 * Shadows may fall past it.
 */
export function lifelikeFrame(
  document: DesignDocument,
  view: LifelikeView,
): Box {
  let box: Box;
  if (view.kind === "face") {
    const piece =
      document.pieces.find((candidate) => candidate.id === view.piece) ??
      (document.pieces[0] as Piece);
    box = { x: 0, y: 0, width: piece.width, height: piece.height };
  } else {
    box = assemblyBounds(document);
    const envelope = envelopeLayout(document);
    if (envelope) box = union(box, envelopeBox(envelope));
    const bounds = assemblyBounds(document);
    for (const accessory of document.accessories) {
      if (accessory.kind === "wax-seal") {
        const r = (accessory.diameter / 2) * 1.1;
        box = union(box, {
          x: accessory.x - r,
          y: accessory.y - r,
          width: 2 * r,
          height: 2 * r,
        });
      } else if (accessory.bow) {
        const w = accessory.width;
        const x =
          accessory.orientation === "horizontal"
            ? bounds.x + bounds.width / 2
            : bounds.x + accessory.offset;
        const y =
          accessory.orientation === "horizontal"
            ? bounds.y + accessory.offset
            : bounds.y + bounds.height / 2;
        box = union(box, {
          x: x - w * 2.8,
          y: y - w * 1.5,
          width: w * 5.6,
          height: w * 4.7,
        });
      }
    }
  }
  const margin = Math.max(box.width, box.height) * 0.03 + 2;
  return {
    x: box.x - margin,
    y: box.y - margin,
    width: box.width + 2 * margin,
    height: box.height + 2 * margin,
  };
}

/** Every kind of grain a document's lifelike views draw. */
function grainsOf(document: DesignDocument): GrainKind[] {
  const kinds = document.pieces.map((piece) => stocks[piece.stock].texture);
  return document.envelope ? [...kinds, "smooth"] : kinds;
}

export interface LifelikeViewProps {
  document: DesignDocument;
  context: RenderContext;
  /**
   * Device pixels to the millimetre where the view is shown, so the paper's
   * grain is drawn as finely as the screen shows it and no finer: finer
   * grain shimmers into moiré. The finest grain when left out.
   */
  pixelsPerMm?: number;
  title?: string;
  className?: string;
  style?: CSSProperties;
}

/**
 * The view's two SVGs, one over the other, in a box that takes the class
 * and style: the still one first, then the light layer when anything
 * catches the light. The light layer gets a compositing layer of its own,
 * so repainting it leaves the other alone; it's redrawn fresh when the
 * screen's density changes, so a zoom leaves it sharp.
 */
function Frame({
  frame,
  title,
  className,
  style,
  pixelsPerMm,
  light,
  children,
}: {
  frame: Box;
  title?: string;
  className?: string;
  style?: CSSProperties;
  pixelsPerMm?: number;
  light: ReactNode;
  children: ReactNode;
}) {
  const viewBox = `${frame.x} ${frame.y} ${frame.width} ${frame.height}`;
  return (
    <div className={className} style={{ position: "relative", ...style }}>
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox={viewBox}
        width="100%"
        height="100%"
        role="img"
        aria-label={title}
        style={{
          aspectRatio: `${frame.width} / ${frame.height}`,
          display: "block",
          // Shadows fall past the frame, onto the table around it.
          overflow: "visible",
        }}
      >
        {title ? <title>{title}</title> : null}
        {children}
      </svg>
      {light ? (
        <svg
          key={pixelsPerMm}
          xmlns="http://www.w3.org/2000/svg"
          viewBox={viewBox}
          width="100%"
          height="100%"
          aria-hidden
          {...{ [LIGHT_LAYER]: "" }}
          style={{
            position: "absolute",
            inset: 0,
            overflow: "visible",
            pointerEvents: "none",
            willChange: "transform",
          }}
        >
          {light}
        </svg>
      ) : null}
    </div>
  );
}

/**
 * A mask hiding the light on whatever lies under the given things: sheets
 * (vellum lets some light through), ribbons and their bows, and seals. It
 * spans only `region`, where the light it masks falls, to stay quick to
 * draw.
 */
function Cover({
  id,
  region,
  pieces,
  ribbons,
  bows,
  seals,
  bounds,
}: {
  id: string;
  region: Box;
  pieces: Piece[];
  ribbons: Ribbon[];
  /** Ribbons whose bow alone covers. */
  bows: Ribbon[];
  seals: Seal[];
  bounds: Box;
}) {
  return (
    <mask
      id={id}
      maskUnits="userSpaceOnUse"
      x={region.x}
      y={region.y}
      width={region.width}
      height={region.height}
    >
      <rect {...region} fill="#ffffff" />
      {pieces.map((piece) => (
        <path
          key={piece.id}
          d={trimPath(piece)}
          transform={placeTransform(piece)}
          fill={stocks[piece.stock].translucent ? "#999999" : "#000000"}
        />
      ))}
      {ribbons.map((ribbon) => (
        <RibbonCover key={ribbon.id} ribbon={ribbon} bounds={bounds} />
      ))}
      {bows.map((ribbon) => (
        <RibbonCover
          key={ribbon.id}
          ribbon={ribbon}
          bounds={bounds}
          band={false}
        />
      ))}
      {seals.map((seal) => (
        <path
          key={seal.id}
          d={sealOutline(seal.id, seal.diameter / 2)}
          transform={`translate(${seal.x} ${seal.y})`}
          fill="#000000"
        />
      ))}
    </mask>
  );
}

/**
 * The finished item lying on the table: the envelope behind, every piece in
 * its place, vellum frosting what it covers, ribbons tied and seals pressed.
 */
export function LifelikeAssemblyView({
  document,
  context,
  pixelsPerMm,
  title,
  className,
  style,
}: LifelikeViewProps) {
  const prefix = svgId(useId(), "lifelike");
  const own = lifelikeIds(prefix);
  const grains = useGrains(grainsOf(document), pixelsPerMm);
  const bounds = assemblyBounds(document);
  const frame = lifelikeFrame(document, { kind: "assembly" });
  const envelope = envelopeLayout(document);
  const ribbons = document.accessories.filter(
    (accessory): accessory is Ribbon => accessory.kind === "ribbon",
  );
  const seals = document.accessories.filter(
    (accessory): accessory is Seal => accessory.kind === "wax-seal",
  );
  let stack: ReactNode[] = envelope
    ? [
        <EnvelopeView
          key="envelope"
          document={document}
          layout={envelope}
          context={context}
          prefix={prefix}
          grain={grains("smooth")}
        />,
      ]
    : [];
  for (const piece of document.pieces) {
    const drawn = (
      <g key={piece.id} transform={placeTransform(piece)}>
        <LifelikePiece
          document={document}
          piece={piece}
          face="front"
          context={context}
          prefix={prefix}
          grains={grains}
        />
      </g>
    );
    if (stocks[piece.stock].translucent && stack.length > 0) {
      // Gather what lies under the vellum so it can be drawn again, frosted.
      const below = `${prefix}-below-${piece.id}`;
      stack = [
        <g key={below} id={below}>
          {stack}
        </g>,
        <Frost
          key={`${below}-frost`}
          piece={piece}
          below={below}
          prefix={prefix}
        />,
        drawn,
      ];
    } else stack.push(drawn);
  }

  // The light on each sheet, hidden under all that lies over it; then the
  // shine on each ribbon, hidden under its bow and the seals; then the
  // glint on each seal, which nothing covers.
  const lights: ReactNode[] = [];
  document.pieces.forEach((piece, index) => {
    if (!shine(piece, "front", context)) return;
    const over = document.pieces.slice(index + 1);
    const covered = over.length > 0 || ribbons.length > 0 || seals.length > 0;
    lights.push(
      <Fragment key={piece.id}>
        {covered ? (
          <Cover
            id={own.cover(piece.id)}
            region={placedBox(piece)}
            pieces={over}
            ribbons={ribbons}
            bows={[]}
            seals={seals}
            bounds={bounds}
          />
        ) : null}
        <g mask={covered ? `url(#${own.cover(piece.id)})` : undefined}>
          <g transform={placeTransform(piece)}>
            <PieceLight
              document={document}
              piece={piece}
              face="front"
              context={context}
              prefix={prefix}
            />
          </g>
        </g>
      </Fragment>,
    );
  });
  for (const ribbon of ribbons.filter(ribbonShines)) {
    const covered = ribbon.bow || seals.length > 0;
    lights.push(
      <Fragment key={ribbon.id}>
        {covered ? (
          <Cover
            id={own.cover(ribbon.id)}
            region={ribbonBox(ribbon, bounds)}
            pieces={[]}
            ribbons={[]}
            bows={ribbon.bow ? [ribbon] : []}
            seals={seals}
            bounds={bounds}
          />
        ) : null}
        <g mask={covered ? `url(#${own.cover(ribbon.id)})` : undefined}>
          <RibbonSheen ribbon={ribbon} bounds={bounds} prefix={prefix} />
        </g>
      </Fragment>,
    );
  }
  for (const seal of seals)
    lights.push(<SealGlint key={seal.id} seal={seal} prefix={prefix} />);

  return (
    <Frame
      frame={frame}
      title={title}
      className={className}
      style={style}
      pixelsPerMm={pixelsPerMm}
      light={
        lights.length > 0 ? (
          <>
            <LightDefs prefix={prefix} />
            {lights}
          </>
        ) : null
      }
    >
      <LifelikeDefs prefix={prefix} grains={grains} />
      {stack}
      {ribbons.map((ribbon) => (
        <LifelikeRibbon
          key={ribbon.id}
          ribbon={ribbon}
          bounds={bounds}
          prefix={prefix}
        />
      ))}
      {/* Seals last: wax is pressed over any ribbon. */}
      {seals.map((seal) => (
        <LifelikeWaxSeal
          key={seal.id}
          seal={seal}
          prefix={prefix}
          initials={
            seal.motif.kind === "initials"
              ? resolveText(seal.motif.text, {
                  fields: context.fields,
                  occasion: document.occasion,
                  language: document.language,
                })
              : ""
          }
          motif={
            seal.motif.kind === "asset"
              ? context.assets(seal.motif.asset)
              : undefined
          }
        />
      ))}
    </Frame>
  );
}

export interface LifelikeFaceViewProps extends LifelikeViewProps {
  /** The piece's id; the first piece when left out. */
  piece?: string;
  face?: FaceName;
}

/** One side of one piece, lying on the table. */
export function LifelikeFaceView({
  document,
  piece: pieceId,
  face = "front",
  context,
  pixelsPerMm,
  title,
  className,
  style,
}: LifelikeFaceViewProps) {
  const prefix = svgId(useId(), "lifelike");
  const piece =
    document.pieces.find((candidate) => candidate.id === pieceId) ??
    (document.pieces[0] as Piece);
  const grains = useGrains([stocks[piece.stock].texture], pixelsPerMm);
  const lit = shine(piece, face, context);
  return (
    <Frame
      frame={lifelikeFrame(document, { kind: "face", piece: piece.id })}
      title={title}
      className={className}
      style={style}
      pixelsPerMm={pixelsPerMm}
      light={
        lit ? (
          <>
            <LightDefs prefix={prefix} />
            <PieceLight
              document={document}
              piece={piece}
              face={face}
              context={context}
              prefix={prefix}
            />
          </>
        ) : null
      }
    >
      <LifelikeDefs prefix={prefix} grains={grains} />
      <LifelikePiece
        document={document}
        piece={piece}
        face={face}
        context={context}
        prefix={prefix}
        grains={grains}
      />
    </Frame>
  );
}
