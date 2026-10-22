import { z } from "zod";
import {
  envelopeStyles,
  fontFamilies,
  inks,
  languages,
  occasions,
  productKinds,
  ribbonMaterials,
  stocks,
  waxColors,
} from "./catalog";
import {
  COLOR_REF_PATTERN,
  type ColorRef,
  HEX_PATTERN,
  type Hex,
  paletteTokens,
} from "./color";

/**
 * A design document: everything needed to draw a printed item, from the paper
 * to the last line of text, with no reference to who it belongs to or where it
 * is stored. The editor, the previews, the AI co-designer and the print files
 * all read and write this one shape.
 *
 * Lengths are millimetres measured from the top-left corner of a piece's trim
 * box (the finished edge); type sizes are points. Text holds field tokens such
 * as {{partner1}}, filled from the design's fields when drawn (see fields.ts).
 */

export const SCHEMA_VERSION = 1;

const mm = z.number().finite();
const positiveMm = z.number().finite().positive();

export const hexSchema = z
  .string()
  .regex(HEX_PATTERN, "Expected a colour like #a1b2c3")
  .transform((value) => value.toLowerCase() as Hex);

export const colorRefSchema = z
  .string()
  .regex(COLOR_REF_PATTERN, 'Expected a colour like #a1b2c3 or "$accent"')
  .transform((value) =>
    value.startsWith("#") ? (value.toLowerCase() as Hex) : value,
  )
  .pipe(z.custom<ColorRef>());

export const paletteSchema = z.object(
  Object.fromEntries(paletteTokens.map((token) => [token, hexSchema])) as {
    [K in (typeof paletteTokens)[number]]: typeof hexSchema;
  },
);

const fontFamilyNames = Object.keys(fontFamilies) as [
  keyof typeof fontFamilies,
  ...(keyof typeof fontFamilies)[],
];

export const textStyleTokens = [
  "names",
  "heading",
  "body",
  "small",
  "script",
  "monogram",
] as const;
export type TextStyleToken = (typeof textStyleTokens)[number];

const textStyleFields = {
  font: z.enum(fontFamilyNames),
  weight: z.number().int().min(100).max(900),
  italic: z.boolean(),
  /** Points. */
  size: z.number().positive().max(400),
  /** Multiple of the type size. */
  lineHeight: z.number().positive().max(4),
  /** Thousandths of an em, as type designers count tracking. */
  tracking: z.number().min(-200).max(1000),
  case: z.enum(["none", "upper", "lower"]),
  color: colorRefSchema,
};

export const textStyleSchema = z.object({
  ...textStyleFields,
  weight: textStyleFields.weight.default(400),
  italic: textStyleFields.italic.default(false),
  lineHeight: textStyleFields.lineHeight.default(1.25),
  tracking: textStyleFields.tracking.default(0),
  case: textStyleFields.case.default("none"),
  color: textStyleFields.color.default("$ink"),
});
/** Changes to a theme style; anything left out follows the theme. */
export const textStyleOverridesSchema = z.object(textStyleFields).partial();
export type TextStyle = z.output<typeof textStyleSchema>;

export const themeSchema = z.object({
  palette: paletteSchema,
  text: z.object(
    Object.fromEntries(
      textStyleTokens.map((token) => [token, textStyleSchema]),
    ) as { [K in TextStyleToken]: typeof textStyleSchema },
  ),
});
export type Theme = z.output<typeof themeSchema>;

export const frameSchema = z.object({
  x: mm,
  y: mm,
  width: positiveMm,
  height: positiveMm,
});
export type Frame = z.output<typeof frameSchema>;

/** Layer id: short, readable, and unique within its document. */
export const idSchema = z
  .string()
  .regex(
    /^[a-z0-9][a-z0-9-]{0,47}$/,
    "Ids are lowercase letters, digits and -",
  );

/**
 * The key of a stored file (artwork, texture, photo). The same in every
 * deployment, so a template moves between them unchanged.
 */
export const assetKeySchema = z
  .string()
  .regex(
    /^[a-z0-9][a-z0-9._-]{0,95}$/,
    "Asset keys are lowercase letters, digits, dots, _ and -",
  );

const layerBase = {
  id: idSchema,
  /** What the designer calls it in the layers panel. */
  name: z.string().max(80).optional(),
  frame: frameSchema,
  /** Degrees clockwise around the frame's centre. */
  rotation: z.number().min(-360).max(360).default(0),
  opacity: z.number().min(0).max(1).default(1),
  hidden: z.boolean().default(false),
  /**
   * Locked layers keep their place and content in simple mode; the template's
   * artwork is usually locked, the couple's details are not.
   */
  locked: z.boolean().default(false),
  ink: z.enum(inks).default("print"),
};

export const textLayerSchema = z.object({
  ...layerBase,
  type: z.literal("text"),
  /** The words, with {{field}} tokens; "\n" starts a new line. */
  text: z.string().max(4000),
  style: z.enum(textStyleTokens),
  /** Changes to the theme's style for this layer only. */
  overrides: textStyleOverridesSchema.default({}),
  align: z.enum(["left", "center", "right"]).default("center"),
  valign: z.enum(["top", "middle", "bottom"]).default("middle"),
  /**
   * "shrink" lowers the size, never below `minSize`, until the words fit the
   * frame; long names then still fit the design.
   */
  fit: z.enum(["none", "shrink"]).default("shrink"),
  minSize: z.number().positive().optional(),
});
export type TextLayer = z.output<typeof textLayerSchema>;

export const imageLayerSchema = z.object({
  ...layerBase,
  type: z.literal("image"),
  /** An asset key; empty on a photo slot the couple hasn't filled yet. */
  asset: assetKeySchema.optional(),
  fit: z.enum(["cover", "contain", "fill"]).default("contain"),
  /** Repaints single-colour line art in this colour; ignored for photos. */
  tint: colorRefSchema.optional(),
  /** A slot the couple fills with their own photo. */
  replaceable: z.boolean().default(false),
  flipX: z.boolean().default(false),
  flipY: z.boolean().default(false),
});
export type ImageLayer = z.output<typeof imageLayerSchema>;

export const strokeSchema = z.object({
  color: colorRefSchema,
  width: positiveMm,
  dash: z.array(positiveMm).max(8).optional(),
});

export const shapeLayerSchema = z.object({
  ...layerBase,
  type: z.literal("shape"),
  shape: z.enum(["rect", "ellipse", "line", "path"]),
  /** SVG path data in the frame's own millimetres, for "path". */
  path: z.string().max(20000).optional(),
  fill: colorRefSchema.nullable().default(null),
  stroke: strokeSchema.nullable().default(null),
  /** Corner radius for "rect". */
  radius: z.number().min(0).default(0),
});
export type ShapeLayer = z.output<typeof shapeLayerSchema>;

export const layerSchema = z.discriminatedUnion("type", [
  textLayerSchema,
  imageLayerSchema,
  shapeLayerSchema,
]);
export type Layer = z.output<typeof layerSchema>;
export type LayerInput = z.input<typeof layerSchema>;

export const faceSchema = z.object({
  /** Printed background; unset shows the paper. */
  background: colorRefSchema.nullable().default(null),
  layers: z.array(layerSchema).max(200).default([]),
});
export type Face = z.output<typeof faceSchema>;
export const faceNames = ["front", "back"] as const;
export type FaceName = (typeof faceNames)[number];

export const pieceShapeSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("rect"), radius: z.number().min(0).default(0) }),
  /** A rounded arch over the top edge, the full width of the piece. */
  z.object({ kind: z.literal("arch") }),
  z.object({
    kind: z.literal("scallop"),
    /** Scallops along the shorter edge. */
    count: z.number().int().min(4).max(40).default(12),
  }),
  /** A custom die line: SVG path data in the piece's millimetres. */
  z.object({ kind: z.literal("die"), path: z.string().min(1).max(20000) }),
]);
export type PieceShape = z.output<typeof pieceShapeSchema>;

export const foldSchema = z.object({
  orientation: z.enum(["vertical", "horizontal"]),
  /** From the left (vertical) or top (horizontal) edge. */
  at: positiveMm,
});

/** Where a piece sits in the assembled item, in millimetres. */
export const placeSchema = z.object({
  x: mm,
  y: mm,
  rotation: z.number().default(0),
});

export const stockIds = Object.keys(stocks) as [
  keyof typeof stocks,
  ...(keyof typeof stocks)[],
];

/**
 * One physical sheet: the card itself, a vellum overlay, a pocket, an insert.
 * `place` positions it in the assembled item, for previews.
 */
export const pieceSchema = z.object({
  id: idSchema,
  role: z.enum(["card", "overlay", "pocket", "insert", "band", "tag"]),
  name: z.string().max(80).optional(),
  width: positiveMm,
  height: positiveMm,
  /** Printed past the trim so cutting never leaves a white edge. */
  bleed: z.number().min(0).max(10).default(3),
  /** Keep text this far inside the trim. */
  safeMargin: z.number().min(0).max(30).default(5),
  shape: pieceShapeSchema.default({ kind: "rect", radius: 0 }),
  fold: foldSchema.nullable().default(null),
  stock: z.enum(stockIds),
  /** The paper's colour; unset uses the stock's own. */
  paper: colorRefSchema.nullable().default(null),
  front: faceSchema,
  back: faceSchema.nullable().default(null),
  place: placeSchema.default({ x: 0, y: 0, rotation: 0 }),
});
export type Piece = z.output<typeof pieceSchema>;

const waxColorIds = Object.keys(waxColors) as [
  keyof typeof waxColors,
  ...(keyof typeof waxColors)[],
];

export const accessorySchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("wax-seal"),
    id: idSchema,
    /** One of the catalog's waxes, or a colour of its own (waxHex). */
    color: z.union([z.enum(waxColorIds), hexSchema]),
    /** Initials pressed into the wax, or the asset key of a motif. */
    motif: z.discriminatedUnion("kind", [
      /** May hold field tokens, such as {{monogram}}. */
      z.object({ kind: z.literal("initials"), text: z.string().max(40) }),
      z.object({ kind: z.literal("asset"), asset: assetKeySchema }),
    ]),
    diameter: z.number().min(15).max(50).default(25),
    /** Centre, in the assembly's millimetres. */
    x: mm,
    y: mm,
  }),
  z.object({
    kind: z.literal("ribbon"),
    id: idSchema,
    material: z.enum(ribbonMaterials),
    color: hexSchema,
    width: z.number().min(2).max(60).default(10),
    orientation: z.enum(["horizontal", "vertical"]),
    /** From the top (horizontal) or left (vertical) edge of the assembly. */
    offset: mm,
    bow: z.boolean().default(false),
  }),
]);
export type Accessory = z.output<typeof accessorySchema>;

export const envelopeSchema = z.object({
  style: z.enum(envelopeStyles),
  color: hexSchema,
  /** A printed liner inside the flap. */
  liner: z
    .object({ asset: assetKeySchema.optional(), color: colorRefSchema })
    .nullable()
    .default(null),
});
export type Envelope = z.output<typeof envelopeSchema>;

export const documentSchema = z
  .object({
    schemaVersion: z.literal(SCHEMA_VERSION),
    occasion: z.enum(occasions),
    kind: z.enum(productKinds),
    /**
     * The language the words are written in; dates are spelled in it. A
     * couple with guests from abroad orders the same design in each.
     */
    language: z.enum(languages).default("ro"),
    theme: themeSchema,
    pieces: z.array(pieceSchema).min(1).max(8),
    accessories: z.array(accessorySchema).max(8).default([]),
    envelope: envelopeSchema.nullable().default(null),
  })
  .superRefine((document, ctx) => {
    const seen = new Set<string>();
    const claim = (id: string, path: (string | number)[]) => {
      if (seen.has(id))
        ctx.addIssue({ code: "custom", message: `Duplicate id "${id}"`, path });
      seen.add(id);
    };
    for (const [p, piece] of document.pieces.entries()) {
      claim(piece.id, ["pieces", p, "id"]);
      for (const faceName of faceNames) {
        for (const [l, layer] of (piece[faceName]?.layers ?? []).entries())
          claim(layer.id, ["pieces", p, faceName, "layers", l, "id"]);
      }
    }
    for (const [a, accessory] of document.accessories.entries())
      claim(accessory.id, ["accessories", a, "id"]);
  });

/** A validated document, with every default filled in. */
export type DesignDocument = z.output<typeof documentSchema>;
/** A document as written by hand or by the AI, defaults optional. */
export type DesignDocumentInput = z.input<typeof documentSchema>;

export function parseDocument(input: unknown): DesignDocument {
  return documentSchema.parse(input);
}

/** Every asset a document draws, each key once. */
export function assetKeys(document: DesignDocument): string[] {
  const keys = new Set<string>();
  for (const piece of document.pieces) {
    for (const face of faceNames) {
      for (const layer of piece[face]?.layers ?? []) {
        if (layer.type === "image" && layer.asset) keys.add(layer.asset);
      }
    }
  }
  for (const accessory of document.accessories) {
    if (accessory.kind === "wax-seal" && accessory.motif.kind === "asset")
      keys.add(accessory.motif.asset);
  }
  if (document.envelope?.liner?.asset) keys.add(document.envelope.liner.asset);
  return [...keys];
}
