import { z } from "zod";
import { ribbonMaterials, stocks, waxHex } from "./catalog";
import { type Hex, resolveColor } from "./color";
import { newLayerId } from "./editing/layers";
import { assemblyBounds } from "./geometry";
import type { Operation } from "./ops";
import {
  type Accessory,
  type DesignDocument,
  hexSchema,
  type Piece,
  stockIds,
} from "./schema";

/**
 * What choosing one of a product's papers, or a choice of one of its order
 * options, does to a design, so the studio shows what the couple orders: the
 * paper it's printed on, the seal's wax or no seal, the ribbon or none, the
 * envelope's colour, its printed liner, the corners. A choice with no look,
 * such as preserved flowers, is ordered in words only.
 */
export const lookSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("paper"),
    stock: z.enum(stockIds),
    /** The paper's colour; null for the stock's own. */
    color: hexSchema.nullable(),
  }),
  z.object({
    kind: z.literal("seal"),
    /** The wax; null for no seal. */
    color: hexSchema.nullable(),
  }),
  z.object({
    kind: z.literal("ribbon"),
    /** null for no ribbon. */
    material: z.enum(ribbonMaterials).nullable(),
    /** null keeps a ribbon's own colour, and ties a new one in ivory. */
    color: hexSchema.nullable(),
  }),
  z.object({ kind: z.literal("envelope"), color: hexSchema }),
  z.object({
    kind: z.literal("liner"),
    /** Lined in the design's ground and art, or left plain. */
    printed: z.boolean(),
  }),
  z.object({
    kind: z.literal("corners"),
    /** 0 for square corners. */
    radius: z.number().min(0).max(20),
  }),
]);
/** A look as the shop keeps it, its colours in any case. */
export type Look = z.input<typeof lookSchema>;
export type LookKind = Look["kind"];

/** What an order option's choices can change: all but the paper, a product's own. */
export const choiceLookKinds = [
  "seal",
  "ribbon",
  "envelope",
  "liner",
  "corners",
] as const satisfies readonly LookKind[];
export type ChoiceLookKind = (typeof choiceLookKinds)[number];

/** Where a new seal and ribbon go: across the lower part, as Jolene ties them. */
const TIED_AT = 0.82;
const SEAL_DIAMETER = 25;
const RIBBON_WIDTH = 10;
const TWINE_WIDTH = 3;
/** A new ribbon's colour when its choice keeps the ribbon's own. */
const IVORY: Hex = "#f3eee4";
/** The envelope a liner goes in when the design has none. */
const PLAIN_ENVELOPE: Hex = "#ffffff";

type Seal = Extract<Accessory, { kind: "wax-seal" }>;
type Ribbon = Extract<Accessory, { kind: "ribbon" }>;

const same = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();
const tenth = (mm: number) => Math.round(mm * 10) / 10;

/** The pieces a paper is chosen for: all but vellum, which stays vellum. */
const papered = (document: DesignDocument) =>
  document.pieces.filter((piece) => !stocks[piece.stock].translucent);

/** The papered pieces cut as rectangles, which corners can round. */
const rectangles = (document: DesignDocument) =>
  papered(document).flatMap((piece) =>
    piece.shape.kind === "rect" ? [{ piece, radius: piece.shape.radius }] : [],
  );

const seals = (document: DesignDocument) =>
  document.accessories.filter(
    (accessory): accessory is Seal => accessory.kind === "wax-seal",
  );

const ribbons = (document: DesignDocument) =>
  document.accessories.filter(
    (accessory): accessory is Ribbon => accessory.kind === "ribbon",
  );

/** Whether a piece is printed on the look's paper, in its colour. */
function onPaper(
  document: DesignDocument,
  piece: Piece,
  look: Extract<Look, { kind: "paper" }>,
) {
  const color = piece.paper
    ? resolveColor(piece.paper, document.theme.palette)
    : stocks[piece.stock].color;
  return (
    piece.stock === look.stock &&
    same(color, look.color ?? stocks[look.stock].color)
  );
}

const sealShows = (seal: Seal, color: string) =>
  same(waxHex(seal.color), color);

const ribbonShows = (
  ribbon: Ribbon,
  { material, color }: Extract<Look, { kind: "ribbon" }>,
) =>
  ribbon.material === material && (color === null || same(ribbon.color, color));

/** Whether the design shows the look, as choosing it would leave it. */
export function showsLook(document: DesignDocument, look: Look): boolean {
  switch (look.kind) {
    case "paper":
      return papered(document).every((piece) => onPaper(document, piece, look));
    case "seal": {
      const all = seals(document);
      const { color } = look;
      return color === null
        ? all.length === 0
        : all.length > 0 && all.every((seal) => sealShows(seal, color));
    }
    case "ribbon": {
      const all = ribbons(document);
      return look.material === null
        ? all.length === 0
        : all.length > 0 && all.every((ribbon) => ribbonShows(ribbon, look));
    }
    case "envelope":
      return (
        document.envelope !== null && same(document.envelope.color, look.color)
      );
    case "liner":
      return (document.envelope?.liner != null) === look.printed;
    case "corners":
      return rectangles(document).every(({ radius }) => radius === look.radius);
  }
}

/**
 * The art a printed liner repeats: the largest of Jolene's pictures on the
 * design's pieces, not a photo the couple puts in.
 */
function linerArt(document: DesignDocument): string | undefined {
  let art: { asset: string; area: number } | undefined;
  for (const piece of papered(document))
    for (const layer of piece.front.layers) {
      if (layer.type !== "image" || !layer.asset || layer.replaceable) continue;
      const area = layer.frame.width * layer.frame.height;
      if (!art || area > art.area) art = { asset: layer.asset, area };
    }
  return art?.asset;
}

/**
 * A new seal: on a ribbon when the design has one, else across the lower
 * part of the item, in the middle, with the couple's monogram.
 */
function newSeal(document: DesignDocument, color: string): Seal {
  const bounds = assemblyBounds(document);
  const ribbon = ribbons(document)[0];
  const centre = {
    x: bounds.x + bounds.width / 2,
    y: bounds.y + bounds.height * TIED_AT,
  };
  if (ribbon?.orientation === "horizontal") centre.y = bounds.y + ribbon.offset;
  if (ribbon?.orientation === "vertical") centre.x = bounds.x + ribbon.offset;
  return {
    kind: "wax-seal",
    id: newLayerId(document, "seal"),
    color: color.toLowerCase() as Hex,
    motif: { kind: "initials", text: "{{monogram}}" },
    diameter: SEAL_DIAMETER,
    x: tenth(centre.x),
    y: tenth(centre.y),
  };
}

/** A new ribbon round the item, under its seal when it has one. */
function newRibbon(
  document: DesignDocument,
  material: Ribbon["material"],
  color: string,
): Ribbon {
  const bounds = assemblyBounds(document);
  const seal = seals(document)[0];
  return {
    kind: "ribbon",
    id: newLayerId(document, "ribbon"),
    material,
    color: color.toLowerCase() as Hex,
    width: material === "twine" ? TWINE_WIDTH : RIBBON_WIDTH,
    orientation: "horizontal",
    offset: tenth(seal ? seal.y - bounds.y : bounds.height * TIED_AT),
    bow: false,
  };
}

/**
 * The operations that make the design show the look, none if it already
 * does. A seal or a ribbon the design has keeps its place and takes the new
 * wax or material; one it lacks is added where Jolene ties them.
 */
export function applyLook(document: DesignDocument, look: Look): Operation[] {
  switch (look.kind) {
    case "paper":
      return papered(document)
        .filter((piece) => !onPaper(document, piece, look))
        .map((piece) => ({
          op: "updatePiece",
          piece: piece.id,
          set: { stock: look.stock, paper: look.color },
        }));
    case "seal": {
      const all = seals(document);
      const { color } = look;
      if (color === null)
        return all.map((seal) => ({ op: "removeAccessory", id: seal.id }));
      if (all.length === 0)
        return [{ op: "setAccessory", accessory: newSeal(document, color) }];
      return all
        .filter((seal) => !sealShows(seal, color))
        .map((seal) => ({ op: "setAccessory", accessory: { ...seal, color } }));
    }
    case "ribbon": {
      const all = ribbons(document);
      const { material, color } = look;
      if (material === null)
        return all.map((ribbon) => ({ op: "removeAccessory", id: ribbon.id }));
      if (all.length === 0)
        return [
          {
            op: "setAccessory",
            accessory: newRibbon(document, material, color ?? IVORY),
          },
        ];
      return all
        .filter((ribbon) => !ribbonShows(ribbon, look))
        .map((ribbon) => ({
          op: "setAccessory",
          accessory: {
            ...ribbon,
            material,
            color: color ?? ribbon.color,
            width:
              ribbon.material === material
                ? ribbon.width
                : material === "twine"
                  ? TWINE_WIDTH
                  : RIBBON_WIDTH,
          },
        }));
    }
    case "envelope": {
      const envelope = document.envelope;
      if (showsLook(document, look)) return [];
      return [
        {
          op: "setEnvelope",
          envelope: {
            style: envelope?.style ?? "classic",
            color: look.color,
            liner: envelope?.liner ?? null,
          },
        },
      ];
    }
    case "liner": {
      const envelope = document.envelope;
      if (showsLook(document, look)) return [];
      if (!look.printed)
        return envelope
          ? [{ op: "setEnvelope", envelope: { ...envelope, liner: null } }]
          : [];
      const art = linerArt(document);
      return [
        {
          op: "setEnvelope",
          envelope: {
            style: envelope?.style ?? "classic",
            color: envelope?.color ?? PLAIN_ENVELOPE,
            liner: { ...(art ? { asset: art } : {}), color: "$paper" },
          },
        },
      ];
    }
    case "corners":
      return rectangles(document)
        .filter(({ radius }) => radius !== look.radius)
        .map(({ piece }) => ({
          op: "updatePiece",
          piece: piece.id,
          set: { shape: { kind: "rect", radius: look.radius } },
        }));
  }
}

/** Whether two looks are the same, whatever the case of their colours. */
export function sameLook(a: Look | null, b: Look | null): boolean {
  if (a === null || b === null) return a === b;
  const normal = (look: Look) =>
    JSON.stringify(
      Object.entries(look)
        .map(([key, value]) => [
          key,
          typeof value === "string" ? value.toLowerCase() : value,
        ])
        .sort(([x], [y]) => String(x).localeCompare(String(y))),
    );
  return normal(a) === normal(b);
}
