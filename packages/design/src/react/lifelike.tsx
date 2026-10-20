import { type CSSProperties, Fragment, type ReactNode, useId } from "react";
import { type Ink, paperTextures, stocks } from "../catalog";
import { type Hex, mix } from "../color";
import { resolveText } from "../fields";
import { assemblyBounds, type Box, trimPath } from "../geometry";
import type { DesignDocument, FaceName, Piece } from "../schema";
import { placeTransform } from "./assembly";
import { defIds } from "./defs";
import { EnvelopeView, envelopeBox, envelopeLayout } from "./envelope";
import { PieceSurface, paperColor } from "./face";
import { type GrainKind, grainMm, useGrains } from "./grain";
import { LayerView } from "./layers";
import {
  type FoilInk,
  foilTones,
  lightX,
  lightY,
  stockThickness,
} from "./materials";
import { LifelikeRibbon } from "./ribbon";
import { type RenderContext, svgId } from "./shared";
import { LifelikeWaxSeal } from "./wax-seal";

/**
 * The lifelike preview: a design as a photograph of the printed suite lying
 * on a table. Paper shows its grain and thickness and casts a soft shadow,
 * foil and spot UV catch the light where the pointer is, vellum frosts what
 * lies under it, and the envelope lies behind. It reads the same document as
 * every other view and draws nothing the print file doesn't: the plain
 * renderer (FaceView, AssemblyView) stays exact for proofs and print.
 */

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
  pearl: `${prefix}-pearl`,
  vellum: `${prefix}-vellum-sheen`,
  /**
   * Spot UV is drawn a second time, as if in silver foil, under this prefix,
   * whose silver is a clear gloss: the layer's own shapes, catching the light.
   */
  gloss: `${prefix}-gloss`,
});

/** Moves with the light, `amount` user units at the pointer's furthest. */
function follow(amount: number): CSSProperties {
  return {
    transform: `translate(calc(var(${lightX}, 0) * ${amount}px), calc(var(${lightY}, 0) * ${amount}px))`,
    transition: "transform 0.45s ease-out",
  };
}

/**
 * Foil as polished metal: bands of light and shade across each shape, which
 * slide as the light moves. Each shape shows the middle third of the bands
 * (more as the light moves): mostly the metal's middle and dark tones, so
 * pale foil still reads on pale paper, crossed by one narrow bright band.
 */
function FoilPaint({ id, ink }: { id: string; ink: FoilInk }) {
  const tone = foilTones(ink);
  const stops: [number, Hex][] = [
    [0, tone.light],
    [0.08, tone.mid],
    [0.17, tone.dark],
    [0.26, tone.mid],
    [0.35, tone.dark],
    [0.44, tone.mid],
    [0.5, tone.light],
    [0.53, tone.glint],
    [0.56, tone.light],
    [0.62, tone.mid],
    [0.71, tone.dark],
    [0.8, tone.deep],
    [0.9, tone.mid],
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
        <rect
          x="-1"
          y="-1"
          width="3"
          height="3"
          fill={`url(#${id}-metal)`}
          style={follow(-0.5)}
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
          style={follow(-0.6)}
        />
      </pattern>
    </>
  );
}

/**
 * A soft sheen across a whole sheet, sliding with the light: pearlescent
 * card's shimmer of pale colour, vellum's faint gloss.
 */
function Sheen({ id, stops }: { id: string; stops: [number, Hex, number][] }) {
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
          style={follow(-0.35)}
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
        <FoilPaint key={ink} id={ids.ink(ink)} ink={ink} />
      ))}
      <GlossPaint id={defIds(own.gloss).ink("foil-silver")} />
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
      <Sheen
        id={own.pearl}
        stops={[
          [0, "#ffffff", 0],
          [0.32, "#ffe4ec", 0],
          [0.4, "#ffeedd", 0.26],
          [0.46, "#fffaf0", 0.36],
          [0.52, "#e3f5ee", 0.24],
          [0.58, "#e5e2fb", 0.2],
          [0.68, "#ffffff", 0],
          [1, "#ffffff", 0],
        ]}
      />
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
 * Over the printing: spot UV's gloss, the paper's grain, pearl's shimmer or
 * vellum's sheen, the fall of the light, and the cut edge catching it.
 */
function PieceFinish({
  document,
  piece,
  face,
  context,
  prefix,
  grains,
}: PieceProps) {
  const own = lifelikeIds(prefix);
  const stock = stocks[piece.stock];
  const area = { x: 0, y: 0, width: piece.width, height: piece.height };
  const glossy = (piece[face]?.layers ?? []).filter(
    (layer) =>
      layer.ink === "spot-uv" && (layer.type !== "image" || layer.tint),
  );
  const grain = grains(stock.texture);
  return (
    <>
      {glossy.map((layer) => (
        <LayerView
          key={layer.id}
          layer={{ ...layer, ink: "foil-silver" satisfies Ink }}
          document={document}
          paper={paperColor(piece, document)}
          prefix={own.gloss}
          context={context}
        />
      ))}
      {grain ? (
        <rect {...area} fill={`url(#${own.grain(stock.texture)})`} />
      ) : null}
      {stock.texture === "pearl" ? (
        <rect {...area} fill={`url(#${own.pearl})`} />
      ) : null}
      {stock.translucent ? (
        <rect {...area} fill={`url(#${own.vellum})`} />
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
  const margin = Math.max(box.width, box.height) * 0.04 + 3;
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

function Frame({
  frame,
  title,
  className,
  style,
  children,
}: {
  frame: Box;
  title?: string;
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
}) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox={`${frame.x} ${frame.y} ${frame.width} ${frame.height}`}
      width="100%"
      role="img"
      aria-label={title}
      className={className}
      style={{
        aspectRatio: `${frame.width} / ${frame.height}`,
        display: "block",
        // Shadows fall past the frame, onto the table around it.
        overflow: "visible",
        ...style,
      }}
    >
      {title ? <title>{title}</title> : null}
      {children}
    </svg>
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
  const grains = useGrains(grainsOf(document), pixelsPerMm);
  const bounds = assemblyBounds(document);
  const envelope = envelopeLayout(document);
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
  return (
    <Frame
      frame={lifelikeFrame(document, { kind: "assembly" })}
      title={title}
      className={className}
      style={style}
    >
      <LifelikeDefs prefix={prefix} grains={grains} />
      {stack}
      {document.accessories.map((accessory) =>
        accessory.kind === "ribbon" ? (
          <LifelikeRibbon
            key={accessory.id}
            ribbon={accessory}
            bounds={bounds}
            prefix={prefix}
          />
        ) : null,
      )}
      {/* Seals last: wax is pressed over any ribbon. */}
      {document.accessories.map((accessory) =>
        accessory.kind === "ribbon" ? null : (
          <LifelikeWaxSeal
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
            motif={
              accessory.motif.kind === "asset"
                ? context.assets(accessory.motif.asset)
                : undefined
            }
          />
        ),
      )}
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
  return (
    <Frame
      frame={lifelikeFrame(document, { kind: "face", piece: piece.id })}
      title={title}
      className={className}
      style={style}
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
