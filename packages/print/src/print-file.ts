import {
  type ColorRef,
  type DesignDocument,
  type Face,
  type FaceName,
  type Fields,
  type FontSpec,
  faceNames,
  fieldKeysUsed,
  fontCharacters,
  type ImageLayer,
  type Ink,
  inkLabels,
  inks,
  type Layer,
  layoutText,
  lineMiddles,
  MM_PER_POINT,
  mmToPt,
  type Piece,
  ptToMm,
  resolveColor,
  resolveText,
  type ShapeLayer,
  stocks,
  type TextLayer,
  type TextLayout,
  trimPath,
} from "@jolene/design";
import PDFDocument from "pdfkit";
import {
  type FaceChoice,
  type FontBook,
  type Face as FontFace,
  middleAboveBaseline,
} from "./fonts";
import { type Picture, readPicture } from "./pictures";

/**
 * The print file of a design: every face of every piece, one page for each of
 * its plates. A page holds the face with its bleed, trimmed at TrimBox, and
 * around it the crop marks, the fold marks and a line saying what it is.
 *
 * The colour plate ("print") is in RGB, as the studio shows it, without the
 * paper's own colour, which is the stock. Every other ink (white, each foil,
 * spot UV, embossing, debossing) has a plate of its own in solid black, for
 * the workshop's machine, at the same size and place. A piece cut to a shape
 * other than a plain rectangle ends with its die line.
 */

/** The file of an asset a design draws. */
export interface AssetFile {
  bytes: Uint8Array;
  /** Single-colour line art that a layer's tint repaints. */
  recolorable: boolean;
}

export interface PrintFileInput {
  document: DesignDocument;
  /** The couple's own details, without examples. */
  fields: Fields;
  /** What the workshop knows the job by, such as "Ana & Mihai · Invitație". */
  title: string;
  fonts: FontBook;
  /** An asset's file, by its key; null when there is none. */
  asset: (key: string) => Promise<AssetFile | null>;
}

/** A page of the print file: a face's plate, or a piece's die line. */
export interface PrintPage {
  piece: string;
  face: FaceName | null;
  plate: Ink | "die";
}

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

export interface PrintFile {
  pdf: Uint8Array;
  pages: PrintPage[];
  issues: PrintIssue[];
  /** Each text layer's lines, by layer id, as the file sets them. */
  layouts: Record<string, TextLayout>;
}

/** Images are checked against this resolution, as print shops ask. */
export const PRINT_DPI = 300;

/** The type of the marks' captions. */
const CAPTION_FONT: FontSpec = { family: "Jost", weight: 400, italic: false };
const CAPTION_SIZE = ptToMm(5.5);
const HAIRLINE = 0.25 * MM_PER_POINT;
/** Crop marks start this far from the trim, past the bleed. */
const MARK_GAP = 3;
const MARK_LENGTH = 5;
const BLACK = "#000000";

const faceLabels: Record<FaceName, string> = { front: "Față", back: "Verso" };

/** Room around the trim for the bleed, the marks and their captions. */
function marginOf(piece: Piece): number {
  return Math.max(piece.bleed, MARK_GAP) + MARK_LENGTH + 4;
}

function textStyleOf(layer: TextLayer, document: DesignDocument) {
  return { ...document.theme.text[layer.style], ...layer.overrides };
}

function fontSpecOf(layer: TextLayer, document: DesignDocument): FontSpec {
  const style = textStyleOf(layer, document);
  return { family: style.font, weight: style.weight, italic: style.italic };
}

interface LayerAt {
  piece: Piece;
  face: FaceName;
  side: Face;
  layer: Layer;
}

function* layersOf(document: DesignDocument): Generator<LayerAt> {
  for (const piece of document.pieces)
    for (const face of faceNames) {
      const side = piece[face];
      if (!side) continue;
      for (const layer of side.layers)
        if (!layer.hidden) yield { piece, face, side, layer };
    }
}

/** Builds the print file of a design. */
export async function makePrintFile(input: PrintFileInput): Promise<PrintFile> {
  const { document, fields, fonts } = input;
  const issues: PrintIssue[] = [];
  const resolve = (text: string) =>
    resolveText(text, {
      fields,
      occasion: document.occasion,
      language: document.language,
    });

  const missing = fieldKeysUsed(document).filter(
    (key) => key !== "monogram" && !fields[key]?.trim(),
  );
  if (missing.length > 0)
    issues.push({ kind: "missing-details", fields: missing });

  // The words, set as the studio sets them, with the fonts they print in.
  const texts = new Map<string, string>();
  const words = [{ spec: CAPTION_FONT, text: input.title }];
  for (const { layer } of layersOf(document)) {
    if (layer.type !== "text") continue;
    const text = resolve(layer.text);
    if (!text.trim()) continue;
    texts.set(layer.id, text);
    words.push({ spec: fontSpecOf(layer, document), text });
  }
  await fonts.load(words);
  const layouts: Record<string, TextLayout> = {};
  const sets = new Map<string, SetText>();
  for (const { piece, face, layer } of layersOf(document)) {
    const text = texts.get(layer.id);
    if (layer.type !== "text" || text === undefined) continue;
    const style = textStyleOf(layer, document);
    const layout = layoutText({
      text,
      style,
      width: layer.frame.width,
      height: layer.frame.height,
      fit: layer.fit,
      minSize: layer.minSize,
      measure: fonts.measure,
    });
    layouts[layer.id] = layout;
    const set = setText(layer, layout, document, fonts);
    sets.set(layer.id, set);
    const at = { piece: piece.id, face, layer: layer.id };
    if (layout.overflows) issues.push({ kind: "overflow", ...at });
    if (outsideSafeArea(layer, set, piece))
      issues.push({ kind: "outside-safe-area", ...at });
    const spec = fontSpecOf(layer, document);
    const letters = [...new Set(text.replace(/\s/g, ""))];
    const lacking = letters.filter((letter) => !fonts.draws(letter, spec));
    if (lacking.length > 0)
      issues.push({
        kind: "missing-glyphs",
        ...at,
        characters: lacking.join(""),
      });
    const unusual = letters.filter(
      (letter) => !fontCharacters.includes(letter),
    );
    if (unusual.length > 0)
      issues.push({
        kind: "unusual-characters",
        ...at,
        characters: unusual.join(""),
      });
  }

  // The images, each file read once.
  const files = new Map<string, Promise<LoadedAsset | null>>();
  const pictureOf = (key: string) => {
    let loaded = files.get(key);
    if (!loaded) {
      loaded = input.asset(key).then(async (file) =>
        file
          ? {
              picture: await readPicture(file.bytes),
              recolorable: file.recolorable,
            }
          : null,
      );
      files.set(key, loaded);
    }
    return loaded;
  };
  const pictures = new Map<string, LoadedAsset>();
  for (const { piece, face, layer } of layersOf(document)) {
    if (layer.type !== "image") continue;
    const at = { piece: piece.id, face, layer: layer.id };
    if (!layer.asset) {
      if (layer.replaceable) issues.push({ kind: "missing-photo", ...at });
      continue;
    }
    const loaded = await pictureOf(layer.asset);
    if (!loaded) {
      issues.push({ kind: "missing-artwork", ...at, asset: layer.asset });
      continue;
    }
    pictures.set(layer.asset, loaded);
    const dpi = Math.floor(resolutionOf(layer, loaded.picture));
    if (dpi < PRINT_DPI) issues.push({ kind: "low-resolution", ...at, dpi });
  }

  // Which pages there are, so each can say which it is.
  const pages: PrintPage[] = [];
  for (const piece of document.pieces) {
    for (const face of faceNames) {
      const side = piece[face];
      if (!side) continue;
      for (const plate of platesOf(side, texts, pictures))
        pages.push({ piece: piece.id, face, plate });
    }
    if (needsDie(piece))
      pages.push({ piece: piece.id, face: null, plate: "die" });
  }

  const pdf = new PDFDocument({
    autoFirstPage: false,
    // No standard font: every font the file uses is embedded.
    font: null as unknown as string,
    pdfVersion: "1.7",
    compress: true,
    info: {
      Title: `Jolene · ${input.title}`,
      Author: "Jolene",
      Creator: "Jolene",
      Producer: "Jolene",
    },
  });
  const chunks: Uint8Array[] = [];
  pdf.on("data", (chunk: Uint8Array) => chunks.push(chunk));
  const ended = new Promise<void>((resolve, reject) => {
    pdf.on("end", resolve);
    pdf.on("error", reject);
  });

  const drawing = new Drawing(pdf, document, fonts, sets, pictures);
  for (const [index, page] of pages.entries()) {
    const piece = document.pieces.find(
      (candidate) => candidate.id === page.piece,
    ) as Piece;
    drawing.startPage(piece);
    if (page.face === null) drawing.dieLine(piece);
    else drawing.face(piece, page.face, page.plate as Ink);
    drawing.marks(piece, [
      `Jolene · ${input.title}`,
      captionOf(document, piece, page, `${index + 1} / ${pages.length}`),
    ]);
    drawing.endPage();
  }
  pdf.end();
  await ended;
  return {
    pdf: new Uint8Array(Buffer.concat(chunks)),
    pages,
    issues,
    layouts,
  };
}

interface LoadedAsset {
  picture: Picture;
  recolorable: boolean;
}

/** The inks a face uses, in the catalog's order: one plate each. */
function platesOf(
  side: Face,
  texts: Map<string, string>,
  pictures: Map<string, LoadedAsset>,
): Ink[] {
  const used = new Set<Ink>();
  if (side.background) used.add("print");
  for (const layer of side.layers) {
    if (layer.hidden) continue;
    const drawn =
      layer.type === "text"
        ? texts.has(layer.id)
        : layer.type === "image"
          ? layer.asset !== undefined && pictures.has(layer.asset)
          : layer.fill !== null || layer.stroke !== null;
    if (drawn) used.add(layer.ink);
  }
  return inks.filter((ink) => used.has(ink));
}

/** A plain rectangle is cut with a guillotine; any other shape needs a die. */
function needsDie(piece: Piece): boolean {
  return piece.shape.kind !== "rect" || piece.shape.radius > 0;
}

function captionOf(
  document: DesignDocument,
  piece: Piece,
  page: PrintPage,
  pageNumber: string,
): string {
  const parts = [piece.name ?? piece.id];
  if (page.face) parts.push(faceLabels[page.face]);
  parts.push(
    page.plate === "die" ? "Contur de tăiere" : inkLabels[page.plate].ro,
  );
  parts.push(`${piece.width} × ${piece.height} mm`);
  const paper = piece.paper
    ? ` ${resolveColor(piece.paper, document.theme.palette)}`
    : "";
  parts.push(`${stocks[piece.stock].labels.ro}${paper}`);
  if (piece.fold) parts.push(`pliere la ${piece.fold.at} mm`);
  parts.push(`pagina ${pageNumber}`);
  return parts.join(" · ");
}

/**
 * Whether the couple's words reach past the safe margin: the ink of their
 * letters, which a wide frame or a tall line can hide. Jolene's own fixed
 * words are placed by hand and left alone.
 */
function outsideSafeArea(
  layer: TextLayer,
  set: SetText,
  piece: Piece,
): boolean {
  if (layer.locked || layer.rotation !== 0) return false;
  const margin = piece.safeMargin - 0.05;
  const { x, y } = layer.frame;
  return set.lines.some(
    (line) =>
      line.ink !== null &&
      (x + line.x + line.ink.left < margin ||
        y + line.baseline + line.ink.top < margin ||
        x + line.x + line.ink.right > piece.width - margin ||
        y + line.baseline + line.ink.bottom > piece.height - margin),
  );
}

/** A text layer's lines in type, in its frame, in millimetres. */
interface SetText {
  sizeMm: number;
  trackingMm: number;
  features: PDFKit.Mixins.OpenTypeFeatures[];
  lines: SetLine[];
}

/** A line in type: its runs, each in one face, from x on its baseline. */
interface SetLine extends TypeLine {
  x: number;
  baseline: number;
}

interface TypeLine {
  runs: { text: string; choice: FaceChoice; at: number }[];
  /** From its first letter's start to its last letter's end. */
  width: number;
  /** Where its letters' ink reaches, from its start on the baseline. */
  ink: { left: number; right: number; top: number; bottom: number } | null;
}

/** Browsers drop ligatures from spaced-out letters, and so does the file. */
function featuresFor(trackingMm: number): PDFKit.Mixins.OpenTypeFeatures[] {
  return (
    trackingMm !== 0 ? { liga: false, clig: false, dlig: false } : []
  ) as PDFKit.Mixins.OpenTypeFeatures[];
}

/**
 * A text layer's lines as the studio's renderer places them (react/layers.tsx):
 * each centred on its middle (lineMiddles), and aligned in the frame by its
 * letters.
 */
function setText(
  layer: TextLayer,
  layout: TextLayout,
  document: DesignDocument,
  fonts: FontBook,
): SetText {
  const style = textStyleOf(layer, document);
  const spec = fontSpecOf(layer, document);
  const sizeMm = ptToMm(layout.size);
  const trackingMm = (style.tracking / 1000) * sizeMm;
  const features = featuresFor(trackingMm);
  const middles = lineMiddles(layout, layer.valign, layer.frame.height);
  // Lines sit on the style's own face, whichever face draws a letter.
  const lift = middleAboveBaseline(fonts.choose(spec).font) * sizeMm;
  const lines = layout.lines.map((line, index) => {
    const type = typeset(fonts, line.text, spec, sizeMm, trackingMm, features);
    const x =
      layer.align === "left"
        ? 0
        : layer.align === "right"
          ? layer.frame.width - type.width
          : (layer.frame.width - type.width) / 2;
    return { ...type, x, baseline: (middles[index] as number) + lift };
  });
  return { sizeMm, trackingMm, features, lines };
}

/** A line of text in the faces that draw its letters (FontBook.runs). */
function typeset(
  fonts: FontBook,
  text: string,
  spec: FontSpec,
  sizeMm: number,
  trackingMm: number,
  features: PDFKit.Mixins.OpenTypeFeatures[],
): TypeLine {
  const runs: TypeLine["runs"] = [];
  let ink: TypeLine["ink"] = null;
  // Where the next letter starts: spacing follows every letter.
  let pen = 0;
  for (const run of fonts.runs(text, spec)) {
    const { font } = run.choice;
    const scale = sizeMm / font.unitsPerEm;
    const glyphs = font.layout(run.text, features as never);
    runs.push({ ...run, at: pen });
    for (const [index, glyph] of glyphs.glyphs.entries()) {
      const position = glyphs.positions[index];
      if (!position) continue;
      const box = glyph.bbox;
      // A space has no ink.
      if (Number.isFinite(box.minX) && box.maxX > box.minX) {
        const left = pen + (position.xOffset + box.minX) * scale;
        const right = pen + (position.xOffset + box.maxX) * scale;
        const top = -(position.yOffset + box.maxY) * scale;
        const bottom = -(position.yOffset + box.minY) * scale;
        ink = ink
          ? {
              left: Math.min(ink.left, left),
              right: Math.max(ink.right, right),
              top: Math.min(ink.top, top),
              bottom: Math.max(ink.bottom, bottom),
            }
          : { left, right, top, bottom };
      }
      pen += position.xAdvance * scale + trackingMm;
    }
  }
  return { runs, width: runs.length > 0 ? pen - trackingMm : 0, ink };
}

/** Where an image goes in its frame, as SVG's preserveAspectRatio puts it. */
function placement(layer: ImageLayer, picture: Picture) {
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
function resolutionOf(layer: ImageLayer, picture: Picture): number {
  const drawn = placement(layer, picture);
  return Math.min(
    picture.width / (drawn.width / 25.4),
    picture.height / (drawn.height / 25.4),
  );
}

/** An image the file holds, drawn with pdfkit's image(). */
interface EmbeddedImage {
  label: string;
  width: number;
  height: number;
  obj: unknown;
  embed(document: PDFKit.PDFDocument): void;
}

class Drawing {
  private readonly images = new Map<string, EmbeddedImage>();
  private readonly registered = new Set<string>();

  constructor(
    private readonly pdf: PDFKit.PDFDocument,
    private readonly document: DesignDocument,
    private readonly fonts: FontBook,
    private readonly sets: Map<string, SetText>,
    private readonly pictures: Map<string, LoadedAsset>,
  ) {}

  /** A page the size of the piece and its margin, drawn in millimetres. */
  startPage(piece: Piece) {
    const margin = marginOf(piece);
    const pt = (mm: number) => mmToPt(mm);
    this.pdf.addPage({
      size: [pt(piece.width + 2 * margin), pt(piece.height + 2 * margin)],
      margin: 0,
    });
    const box = (outset: number) => [
      pt(margin - outset),
      pt(margin - outset),
      pt(margin + piece.width + outset),
      pt(margin + piece.height + outset),
    ];
    const page = this.pdf.page as unknown as {
      dictionary: { data: Record<string, unknown> };
    };
    page.dictionary.data.TrimBox = box(0);
    page.dictionary.data.BleedBox = box(piece.bleed);
    this.pdf.save();
    this.pdf.translate(pt(margin), pt(margin));
    this.pdf.scale(pt(1));
  }

  endPage() {
    this.pdf.restore();
  }

  /** One face's plate: its layers in that ink, within the bleed. */
  face(piece: Piece, face: FaceName, plate: Ink) {
    const side = piece[face] as Face;
    const { pdf } = this;
    const b = piece.bleed;
    const area = [-b, -b, piece.width + 2 * b, piece.height + 2 * b] as const;
    pdf.save();
    pdf.rect(...area).clip();
    if (plate === "print" && side.background)
      pdf
        .rect(...area)
        .fill(resolveColor(side.background, this.document.theme.palette));
    for (const layer of side.layers) {
      if (layer.hidden || layer.ink !== plate) continue;
      const { x, y, width, height } = layer.frame;
      pdf.save();
      pdf.translate(x, y);
      if (layer.rotation)
        pdf.rotate(layer.rotation, { origin: [width / 2, height / 2] });
      // A plate is all or nothing: only the colour plate is see-through.
      if (plate === "print" && layer.opacity < 1) pdf.opacity(layer.opacity);
      if (layer.type === "text") this.text(layer, plate);
      else if (layer.type === "image") this.image(layer, plate);
      else this.shape(layer, plate);
      pdf.restore();
    }
    pdf.restore();
  }

  private text(layer: TextLayer, plate: Ink) {
    const set = this.sets.get(layer.id);
    if (!set) return;
    const style = textStyleOf(layer, this.document);
    const color =
      plate === "print"
        ? resolveColor(style.color, this.document.theme.palette)
        : BLACK;
    // A bold the family lacks is drawn thickened, as browsers do.
    this.pdf
      .fillColor(color)
      .strokeColor(color)
      .lineWidth(set.sizeMm / 26);
    for (const line of set.lines)
      this.write(line, line.x, line.baseline, set.sizeMm, set.trackingMm);
  }

  /** Draws a line of type from a point on its baseline. */
  private write(
    line: TypeLine,
    x: number,
    baseline: number,
    sizeMm: number,
    trackingMm: number,
  ) {
    for (const { text, choice, at } of line.runs)
      this.pdf
        .font(this.register(choice.face, choice.font))
        .fontSize(sizeMm)
        .text(text, x + at, baseline, {
          lineBreak: false,
          baseline: "alphabetic",
          characterSpacing: trackingMm,
          features: featuresFor(trackingMm),
          oblique: choice.fakeItalic,
          fill: true,
          stroke: choice.fakeBold,
        });
  }

  /** Registers a face with the file once, under its own name. */
  private register(face: FontFace, font: unknown): string {
    const name = `${face.family} ${face.weight}${face.italic ? " italic" : ""}`;
    if (!this.registered.has(name)) {
      this.pdf.registerFont(name, font as Buffer);
      this.registered.add(name);
    }
    return name;
  }

  private image(layer: ImageLayer, plate: Ink) {
    if (!layer.asset) return;
    const loaded = this.pictures.get(layer.asset);
    if (!loaded) return;
    const { picture, recolorable } = loaded;
    const palette = this.document.theme.palette;
    // What the screen shows: line art repainted in its tint, else the image;
    // on another plate, whatever the image covers, in black.
    const paint =
      plate !== "print"
        ? BLACK
        : layer.tint && recolorable
          ? resolveColor(layer.tint, palette)
          : null;
    const { pdf } = this;
    const { width, height } = layer.frame;
    pdf.save();
    pdf.rect(0, 0, width, height).clip();
    if (layer.flipX || layer.flipY) {
      pdf.translate(layer.flipX ? width : 0, layer.flipY ? height : 0);
      pdf.scale(layer.flipX ? -1 : 1, layer.flipY ? -1 : 1);
    }
    const at = placement(layer, picture);
    if (paint && "jpeg" in picture) {
      // An opaque image covers all of its place.
      pdf.rect(at.x, at.y, at.width, at.height).fill(paint);
    } else {
      const image = this.embedded(layer.asset, picture, paint);
      pdf.image(image as never, at.x, at.y, {
        width: at.width,
        height: at.height,
      });
    }
    pdf.restore();
  }

  /** An image held once in the file for every page that draws it. */
  private embedded(
    key: string,
    picture: Picture,
    paint: string | null,
  ): EmbeddedImage {
    const id = `${key}|${paint ?? "colour"}`;
    let image = this.images.get(id);
    if (image) return image;
    const label = `J${this.images.size + 1}`;
    const { width, height } = picture;
    if ("jpeg" in picture) {
      const pdf = this.pdf as unknown as {
        openImage(src: Buffer): EmbeddedImage;
      };
      image = pdf.openImage(Buffer.from(picture.jpeg));
    } else {
      const { rgb, alpha } = picture;
      image = {
        label,
        width,
        height,
        obj: null,
        embed(pdf) {
          const ref = (data: Record<string, unknown>) =>
            (pdf as unknown as { ref(data: object): PdfReference }).ref(data);
          const smask = ref({
            Type: "XObject",
            Subtype: "Image",
            Width: width,
            Height: height,
            BitsPerComponent: 8,
            ColorSpace: "DeviceGray",
          });
          smask.end(Buffer.from(alpha));
          const colour = ref({
            Type: "XObject",
            Subtype: "Image",
            Width: width,
            Height: height,
            BitsPerComponent: 8,
            ColorSpace: "DeviceRGB",
            SMask: smask,
          });
          colour.end(Buffer.from(paint ? solid(paint, width * height) : rgb));
          this.obj = colour;
        },
      };
    }
    this.images.set(id, image);
    return image;
  }

  private shape(layer: ShapeLayer, plate: Ink) {
    const { pdf } = this;
    const palette = this.document.theme.palette;
    const colour = (ref: ColorRef) =>
      plate === "print" ? resolveColor(ref, palette) : BLACK;
    const fill = layer.fill ? colour(layer.fill) : null;
    const stroke = layer.stroke ? colour(layer.stroke.color) : null;
    const { width, height } = layer.frame;
    pdf.miterLimit(4);
    if (layer.shape === "line") {
      const paint = stroke ?? fill;
      if (!paint) return;
      pdf.lineWidth(layer.stroke?.width ?? height);
      if (layer.stroke?.dash) dash(pdf, layer.stroke.dash);
      pdf
        .moveTo(0, height / 2)
        .lineTo(width, height / 2)
        .stroke(paint);
      return;
    }
    if (layer.shape === "rect") {
      if (layer.radius > 0) pdf.roundedRect(0, 0, width, height, layer.radius);
      else pdf.rect(0, 0, width, height);
    } else if (layer.shape === "ellipse") {
      pdf.ellipse(width / 2, height / 2, width / 2, height / 2);
    } else if (layer.path) {
      pdf.path(layer.path);
    } else return;
    if (layer.stroke) {
      pdf.lineWidth(layer.stroke.width);
      if (layer.stroke.dash) dash(pdf, layer.stroke.dash);
    }
    if (fill && stroke) pdf.fillAndStroke(fill, stroke);
    else if (fill) pdf.fill(fill);
    else if (stroke) pdf.stroke(stroke);
  }

  /** Where the die cuts the piece, and where it folds. */
  dieLine(piece: Piece) {
    const { pdf } = this;
    pdf.save();
    pdf.lineWidth(HAIRLINE).path(trimPath(piece)).stroke(BLACK);
    if (piece.fold) {
      dash(pdf, [2, 1.5]);
      const { at } = piece.fold;
      if (piece.fold.orientation === "vertical")
        pdf.moveTo(at, 0).lineTo(at, piece.height);
      else pdf.moveTo(0, at).lineTo(piece.width, at);
      pdf.stroke(BLACK);
    }
    pdf.restore();
  }

  /** Crop marks at the corners, fold marks, and a caption above and below. */
  marks(piece: Piece, [above, below]: [string, string]) {
    const { pdf } = this;
    const { width: w, height: h } = piece;
    const gap = Math.max(piece.bleed, MARK_GAP);
    const far = gap + MARK_LENGTH;
    pdf.save();
    pdf.lineWidth(HAIRLINE).strokeColor(BLACK);
    for (const x of [0, w])
      for (const y of [0, h]) {
        const out = { x: x === 0 ? -1 : 1, y: y === 0 ? -1 : 1 };
        pdf
          .moveTo(x + out.x * gap, y)
          .lineTo(x + out.x * far, y)
          .stroke();
        pdf
          .moveTo(x, y + out.y * gap)
          .lineTo(x, y + out.y * far)
          .stroke();
      }
    if (piece.fold) {
      dash(pdf, [1, 1]);
      const { at } = piece.fold;
      for (const side of [-1, 1]) {
        if (piece.fold.orientation === "vertical") {
          const from = side < 0 ? -gap : h + gap;
          pdf
            .moveTo(at, from)
            .lineTo(at, from + side * MARK_LENGTH)
            .stroke();
        } else {
          const from = side < 0 ? -gap : w + gap;
          pdf
            .moveTo(from, at)
            .lineTo(from + side * MARK_LENGTH, at)
            .stroke();
        }
      }
      pdf.undash();
    }
    pdf.fillColor(BLACK);
    const caption = (text: string, baseline: number) =>
      this.write(
        typeset(this.fonts, text, CAPTION_FONT, CAPTION_SIZE, 0, []),
        0,
        baseline,
        CAPTION_SIZE,
        0,
      );
    caption(above, -far - 1.5);
    caption(below, h + far + 1.5 + CAPTION_SIZE * 0.7);
    pdf.restore();
  }
}

/** A dash pattern; pdfkit takes a list, though its types say one length. */
function dash(pdf: PDFKit.PDFDocument, lengths: number[]) {
  pdf.dash(lengths as unknown as number, {});
}

interface PdfReference {
  data: Record<string, unknown>;
  end(chunk?: Uint8Array): void;
}

/** `pixels` pixels of one colour, as RGB. */
function solid(hex: string, pixels: number): Uint8Array {
  const value = Number.parseInt(hex.slice(1), 16);
  const rgb = new Uint8Array(pixels * 3);
  for (let pixel = 0; pixel < pixels; pixel++) {
    rgb[pixel * 3] = (value >> 16) & 0xff;
    rgb[pixel * 3 + 1] = (value >> 8) & 0xff;
    rgb[pixel * 3 + 2] = value & 0xff;
  }
  return rgb;
}
