import { describe, expect, test } from "bun:test";
import {
  checkDesign,
  imagePlacement,
  imageResolution,
  unusualCharacters,
} from "./checks";
import { type ImageLayer, parseDocument } from "./schema";

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
      names: { font: "Bellefair", size: 28, lineHeight: 1.1 },
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
      width: 120,
      height: 170,
      stock: "cotton-350",
      front: {
        layers: [
          {
            id: "names",
            type: "text",
            style: "names",
            text: "{{partner1}} ♥ {{partner2}}",
            frame: { x: 10, y: 20, width: 100, height: 20 },
          },
          {
            id: "godparents",
            type: "text",
            style: "body",
            text: "Nași: {{godparents}}",
            frame: { x: 10, y: 45, width: 100, height: 8 },
          },
          {
            id: "monogram",
            type: "text",
            style: "monogram",
            text: "{{monogram}}",
            frame: { x: 40, y: 55, width: 40, height: 12 },
          },
          {
            id: "verse",
            type: "text",
            style: "body",
            fit: "none",
            text: "Iubirea răbdă totul, crede totul, nădăjduiește totul, suferă totul și nu va pieri niciodată",
            frame: { x: 10, y: 70, width: 100, height: 5 },
          },
          {
            id: "ring",
            type: "text",
            style: "body",
            text: "💍",
            frame: { x: 10, y: 80, width: 100, height: 8 },
          },
          {
            id: "edge",
            type: "text",
            style: "small",
            align: "left",
            text: "Prea aproape",
            frame: { x: 1, y: 150, width: 60, height: 6 },
          },
          {
            id: "signature",
            type: "text",
            style: "small",
            align: "left",
            locked: true,
            text: "Jolene",
            frame: { x: 1, y: 160, width: 30, height: 6 },
          },
          {
            id: "photo",
            type: "image",
            replaceable: true,
            frame: { x: 35, y: 95, width: 50, height: 35 },
          },
          {
            id: "draft",
            type: "text",
            style: "body",
            hidden: true,
            text: "💍",
            frame: { x: 0, y: 0, width: 10, height: 8 },
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
            id: "sprig",
            type: "image",
            asset: "sprig",
            frame: { x: 30, y: 120, width: 60, height: 30 },
          },
        ],
      },
    },
  ],
});

const fields = { partner1: "Ana", partner2: "Mihai" };
const sizes: Record<string, { width: number; height: number }> = {
  tiny: { width: 10, height: 10 },
  // 720 pixels across 60 mm: just over 300 dpi.
  sprig: { width: 720, height: 360 },
};
const picture = (layer: ImageLayer & { asset: string }) =>
  sizes[layer.asset] ?? null;
const at = (face: "front" | "back", layer: string) => ({
  piece: "card",
  face,
  layer,
});

describe("checkDesign", () => {
  test("says what to look at, layer by layer, as the faces stack them", () => {
    const { issues } = checkDesign(document, fields, { picture });
    expect(issues).toEqual([
      // The monogram follows the names, so it's never missing.
      { kind: "missing-details", fields: ["godparents"] },
      { kind: "overflow", ...at("front", "verse") },
      { kind: "unusual-characters", ...at("front", "ring"), characters: "💍" },
      // Jolene's own locked words are placed by hand.
      { kind: "outside-safe-area", ...at("front", "edge") },
      { kind: "missing-photo", ...at("front", "photo") },
      { kind: "missing-artwork", ...at("back", "lost"), asset: "lost" },
      { kind: "low-resolution", ...at("back", "tiny"), dpi: 5 },
    ]);
  });

  test("lays out only the words that print", () => {
    const { layouts } = checkDesign(document, fields);
    // Nași go until they're named; hidden words never print.
    expect(Object.keys(layouts).sort()).toEqual([
      "edge",
      "monogram",
      "names",
      "ring",
      "signature",
      "verse",
    ]);
    expect(layouts.names?.lines.map((line) => line.text)).toEqual([
      "Ana ♥ Mihai",
    ]);
    expect(layouts.monogram?.lines.map((line) => line.text)).toEqual(["A & M"]);
  });

  test("measures the safe margin by where the letters reach", () => {
    // Letters that start 3 mm into their line's box, past the margin's 5 mm.
    const { issues } = checkDesign(document, fields, {
      bounds: (_text, _font, sizeMm) => ({
        left: 4.5,
        right: 10,
        top: -sizeMm / 3,
        bottom: sizeMm / 3,
      }),
    });
    expect(issues.some((issue) => issue.kind === "outside-safe-area")).toBe(
      false,
    );
  });

  test("leaves images unchecked when their size isn't known", () => {
    const { issues } = checkDesign(document, fields, {
      picture: () => undefined,
    });
    expect(
      issues.filter((issue) =>
        ["missing-artwork", "low-resolution"].includes(issue.kind),
      ),
    ).toEqual([]);
  });

  test("lists letters no face draws, when told", () => {
    const { issues } = checkDesign(document, fields, {
      lacking: (text) => (text.includes("♥") ? "♥" : ""),
    });
    expect(issues).toContainEqual({
      kind: "missing-glyphs",
      ...at("front", "names"),
      characters: "♥",
    });
  });
});

describe("unusualCharacters", () => {
  test("names letters the studio loads no typeface for, once each", () => {
    expect(unusualCharacters("Iași, 12 iunie ♥ ★ ∞")).toBe("");
    expect(unusualCharacters("Ana 💍 Mihai 💍 🥂")).toBe("💍🥂");
  });
});

describe("imageResolution", () => {
  const layer = (fit: ImageLayer["fit"]) =>
    ({ fit, frame: { x: 0, y: 0, width: 50.8, height: 25.4 } }) as ImageLayer;
  const photo = { width: 600, height: 600 };

  test("follows how the image fills its frame", () => {
    // Contained, 600 pixels span the frame's 1-inch height.
    expect(imageResolution(layer("contain"), photo)).toBeCloseTo(600);
    // Covering, they span its 2-inch width.
    expect(imageResolution(layer("cover"), photo)).toBeCloseTo(300);
    expect(imagePlacement(layer("contain"), photo)).toEqual({
      x: 12.7,
      y: 0,
      width: 25.4,
      height: 25.4,
    });
  });
});
