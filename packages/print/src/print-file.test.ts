import { beforeAll, describe, expect, test } from "bun:test";
import { inflateSync } from "node:zlib";
import { mmToPt, parseDocument } from "@jolene/design";
import sharp from "sharp";
import { fixtureFonts } from "./fixtures";
import { FontBook } from "./fonts";
import { type AssetFile, makePrintFile, type PrintFile } from "./print-file";

const document = parseDocument({
  schemaVersion: 1,
  occasion: "wedding",
  kind: "invitation",
  theme: {
    palette: {
      ink: "#2f2a26",
      accent: "#7a4b5c",
      muted: "#77705f",
      paper: "#fbf8f2",
      art: "#56664a",
    },
    text: {
      names: { font: "Bellefair", size: 28, lineHeight: 1.1, color: "$accent" },
      heading: { font: "Jost", size: 9, tracking: 200, case: "upper" },
      body: { font: "Jost", size: 10, lineHeight: 1.4 },
      small: { font: "Jost", size: 7 },
      script: { font: "Bellefair", size: 14 },
      monogram: { font: "Bellefair", size: 20 },
    },
  },
  pieces: [
    {
      id: "card",
      role: "card",
      name: "Invitația",
      width: 120,
      height: 170,
      // Rounded corners need a die.
      shape: { kind: "rect", radius: 4 },
      stock: "cotton-350",
      front: {
        background: "$paper",
        layers: [
          {
            id: "sprig",
            type: "image",
            asset: "sprig",
            tint: "$art",
            locked: true,
            frame: { x: 30, y: 10, width: 60, height: 30 },
          },
          {
            id: "names",
            type: "text",
            style: "names",
            ink: "foil-gold",
            text: "{{partner1}} ♥ {{partner2}}",
            frame: { x: 10, y: 50, width: 100, height: 20 },
          },
          {
            id: "date",
            type: "text",
            style: "heading",
            text: "{{date:long}}",
            frame: { x: 10, y: 75, width: 100, height: 8 },
          },
          {
            id: "godparents",
            type: "text",
            style: "body",
            text: "Nași: {{godparents}}",
            frame: { x: 10, y: 85, width: 100, height: 8 },
          },
          {
            id: "rule",
            type: "shape",
            shape: "line",
            stroke: { color: "$muted", width: 0.3 },
            frame: { x: 40, y: 95, width: 40, height: 1 },
          },
          {
            id: "ring",
            type: "text",
            style: "body",
            text: "💍",
            frame: { x: 10, y: 100, width: 100, height: 8 },
          },
          {
            id: "photo",
            type: "image",
            replaceable: true,
            frame: { x: 35, y: 110, width: 50, height: 35 },
          },
          {
            id: "edge",
            type: "text",
            style: "small",
            align: "left",
            text: "Prea aproape de margine",
            frame: { x: 1, y: 155, width: 60, height: 6 },
          },
          {
            id: "draft",
            type: "text",
            style: "body",
            hidden: true,
            text: "Ascuns",
            frame: { x: 10, y: 20, width: 100, height: 8 },
          },
        ],
      },
      back: {
        layers: [
          {
            id: "lost",
            type: "image",
            asset: "lost",
            frame: { x: 10, y: 10, width: 20, height: 20 },
          },
          {
            id: "tiny",
            type: "image",
            asset: "tiny",
            frame: { x: 35, y: 60, width: 50, height: 50 },
          },
          {
            id: "white",
            type: "shape",
            shape: "rect",
            ink: "white",
            fill: "#ffffff",
            frame: { x: 20, y: 120, width: 80, height: 30 },
          },
        ],
      },
    },
  ],
});

let file: PrintFile;
beforeAll(async () => {
  // Line art 720 pixels across for 60 mm: just over 300 dpi.
  const sprig = await sharp({
    create: {
      width: 720,
      height: 360,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite([
      {
        input: Buffer.from(
          '<svg width="720" height="360"><ellipse cx="360" cy="180" rx="300" ry="120" fill="#000"/></svg>',
        ),
      },
    ])
    .png()
    .toBuffer();
  // A photo 10 pixels across for 50 mm.
  const tiny = await sharp({
    create: { width: 10, height: 10, channels: 3, background: "#806040" },
  })
    .jpeg()
    .toBuffer();
  const assets: Record<string, AssetFile> = {
    sprig: { bytes: new Uint8Array(sprig), recolorable: true },
    tiny: { bytes: new Uint8Array(tiny), recolorable: false },
  };
  file = await makePrintFile({
    document,
    fields: { partner1: "Ana", partner2: "Mihai", date: "2027-06-12" },
    title: "Ana & Mihai · Invitație",
    fonts: new FontBook(fixtureFonts().source),
    asset: async (key) => assets[key] ?? null,
  });
});

/** The pages of a file pdfkit wrote: their boxes, and their drawing. */
function pagesOf(pdf: Uint8Array) {
  const text = Buffer.from(pdf).toString("latin1");
  const objects = new Map<string, { dict: string; end: number }>();
  for (const match of text.matchAll(/(\d+) 0 obj\n<<\n(.*?)\n>>\n/gs))
    objects.set(match[1] as string, {
      dict: match[2] as string,
      end: match.index + match[0].length,
    });
  const field = (dict: string, name: string) =>
    new RegExp(`/${name} (\\[[^\\]]*\\]|\\d+ 0 R|\\S+)`).exec(dict)?.[1] ?? "";
  const numbers = (dict: string, name: string) =>
    field(dict, name).slice(1, -1).split(" ").map(Number);
  const stream = (ref: string) => {
    const object = objects.get(ref.split(" ")[0] as string);
    if (!object) throw new Error(`No object ${ref}`);
    const length = Number(field(object.dict, "Length"));
    const start = object.end + "stream\n".length;
    return inflateSync(
      Buffer.from(text.slice(start, start + length), "latin1"),
    ).toString("latin1");
  };
  const tree = [...objects.values()].find(({ dict }) =>
    dict.includes("/Type /Pages"),
  );
  const kids = [...field(tree?.dict ?? "", "Kids").matchAll(/(\d+) 0 R/g)];
  return kids.map(([, id]) => {
    const { dict } = objects.get(id as string) as { dict: string };
    return {
      media: numbers(dict, "MediaBox"),
      trim: numbers(dict, "TrimBox"),
      bleed: numbers(dict, "BleedBox"),
      drawing: stream(field(dict, "Contents")),
    };
  });
}

/** The fill colours a page's drawing sets, as pdfkit writes them. */
const fills = (drawing: string) => [
  ...new Set(
    [...drawing.matchAll(/([\d.]+ [\d.]+ [\d.]+) scn/g)].map(
      ([, colour]) => colour,
    ),
  ),
];
const rgb = (hex: string) =>
  [1, 3, 5]
    .map((at) => Number.parseInt(hex.slice(at, at + 2), 16) / 255)
    .join(" ");

describe("makePrintFile", () => {
  test("has a page for each plate of each face, then the die line", () => {
    expect(file.pages).toEqual([
      { piece: "card", face: "front", plate: "print" },
      { piece: "card", face: "front", plate: "foil-gold" },
      { piece: "card", face: "back", plate: "print" },
      { piece: "card", face: "back", plate: "white" },
      { piece: "card", face: null, plate: "die" },
    ]);
    expect(pagesOf(file.pdf)).toHaveLength(5);
  });

  test("trims at the piece, with its bleed and room for the marks", () => {
    const [page] = pagesOf(file.pdf);
    const pt = (mm: number) => expect.closeTo(mmToPt(mm), 5);
    // 3 mm bleed, then 5 mm marks 3 mm out, then room for their captions.
    expect(page?.media).toEqual([0, 0, pt(144), pt(194)]);
    expect(page?.trim).toEqual([pt(12), pt(12), pt(132), pt(182)]);
    expect(page?.bleed).toEqual([pt(9), pt(9), pt(135), pt(185)]);
  });

  test("prints each ink but colour on a plate of its own, in black", () => {
    const [front, foil, , white, die] = pagesOf(file.pdf).map((page) =>
      fills(page.drawing),
    );
    // The face's background and the date's ink; the names are foil.
    expect(front).toContain(rgb("#fbf8f2"));
    expect(front).toContain(rgb("#2f2a26"));
    expect(front).not.toContain(rgb("#7a4b5c"));
    for (const plate of [foil, white, die]) expect(plate).toEqual(["0 0 0"]);
  });

  test("embeds every face it draws, symbols included", () => {
    const pdf = Buffer.from(file.pdf).toString("latin1");
    const faces = new Set(
      [...pdf.matchAll(/\/BaseFont \/[A-Z]{6}\+(\S+)/g)].map(
        ([, name]) => name,
      ),
    );
    expect([...faces].sort()).toEqual([
      "Bellefair-Regular",
      "Jost-Regular",
      "NotoSansSymbols2-Regular",
    ]);
    expect(pdf).not.toContain("Helvetica");
  });

  test("sets the words as the studio does", () => {
    expect(file.layouts.names?.lines.map((line) => line.text)).toEqual([
      "Ana ♥ Mihai",
    ]);
    expect(file.layouts.date?.lines.map((line) => line.text)).toEqual([
      "SÂMBĂTĂ, 12 IUNIE 2027",
    ]);
    // The line about nași goes until they are named; hidden words never print.
    expect(Object.keys(file.layouts).sort()).toEqual([
      "date",
      "edge",
      "names",
      "ring",
    ]);
  });

  test("says what to look at before printing", () => {
    const at = (face: "front" | "back", layer: string) => ({
      piece: "card",
      face,
      layer,
    });
    expect(file.issues).toEqual([
      { kind: "missing-details", fields: ["godparents"] },
      { kind: "missing-glyphs", ...at("front", "ring"), characters: "💍" },
      { kind: "unusual-characters", ...at("front", "ring"), characters: "💍" },
      { kind: "outside-safe-area", ...at("front", "edge") },
      { kind: "missing-photo", ...at("front", "photo") },
      { kind: "missing-artwork", ...at("back", "lost"), asset: "lost" },
      { kind: "low-resolution", ...at("back", "tiny"), dpi: 5 },
    ]);
  });
});
