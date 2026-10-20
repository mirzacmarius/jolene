import type { Labels, WaxColor } from "./catalog";
import type { Palette } from "./color";

export interface PalettePreset {
  labels: Labels;
  palette: Palette;
  /** The wax a seal takes when the palette is chosen. */
  wax: WaxColor;
}

/**
 * Palettes the studio offers in one click, each tuned so the ink reads on its
 * paper (contrast of 7:1 or more) and the art sits quietly behind the words.
 */
export const palettePresets = {
  eucalipt: {
    labels: { ro: "Eucalipt", en: "Eucalyptus" },
    palette: {
      ink: "#3d3a35",
      accent: "#56664a",
      muted: "#77705f",
      paper: "#f7f3ea",
      art: "#76886a",
    },
    wax: "sage",
  },
  "trandafir-prafuit": {
    labels: { ro: "Trandafir prăfuit", en: "Dusty rose" },
    palette: {
      ink: "#3f3437",
      accent: "#94596a",
      muted: "#8a7476",
      paper: "#faf3f1",
      art: "#c08a8f",
    },
    wax: "blush",
  },
  bleumarin: {
    labels: { ro: "Bleumarin", en: "Navy" },
    palette: {
      ink: "#1f2a44",
      accent: "#24365c",
      muted: "#6b7488",
      paper: "#f8f6f1",
      art: "#8fa0bf",
    },
    wax: "navy",
  },
  terracotta: {
    labels: { ro: "Terracotta", en: "Terracotta" },
    palette: {
      ink: "#3b2e28",
      accent: "#a4512f",
      muted: "#8c6f60",
      paper: "#faf4ec",
      art: "#c98a62",
    },
    wax: "gold",
  },
  lavanda: {
    labels: { ro: "Lavandă", en: "Lavender" },
    palette: {
      ink: "#36324a",
      accent: "#6f5f96",
      muted: "#85809a",
      paper: "#f8f6fa",
      art: "#a497c4",
    },
    wax: "ivory",
  },
  smarald: {
    labels: { ro: "Smarald", en: "Emerald" },
    palette: {
      ink: "#1e2f2a",
      accent: "#1f5446",
      muted: "#63716b",
      paper: "#f6f4ee",
      art: "#3f7a68",
    },
    wax: "gold",
  },
  visiniu: {
    labels: { ro: "Vișiniu", en: "Burgundy" },
    palette: {
      ink: "#3a2226",
      accent: "#7a2836",
      muted: "#8b6b70",
      paper: "#faf5f0",
      art: "#a5585f",
    },
    wax: "burgundy",
  },
  "negru-ivoriu": {
    labels: { ro: "Negru și ivoriu", en: "Black and ivory" },
    palette: {
      ink: "#1c1b1a",
      accent: "#1c1b1a",
      muted: "#6d6a64",
      paper: "#fbf8f1",
      art: "#3b3936",
    },
    wax: "black",
  },
} as const satisfies Record<string, PalettePreset>;
export type PalettePresetId = keyof typeof palettePresets;
