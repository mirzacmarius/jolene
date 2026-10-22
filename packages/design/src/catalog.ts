/**
 * The fixed vocabulary designs are made from: what is being made, on which
 * paper, in which inks and finishes. Labels are given in every language the
 * studio speaks, so the catalog can be shown without a dictionary lookup.
 */

export const languages = ["ro", "en"] as const;
export type Language = (typeof languages)[number];
export type Labels = Record<Language, string>;

export const occasions = ["wedding", "christening"] as const;
export type Occasion = (typeof occasions)[number];

export const occasionLabels: Record<Occasion, Labels> = {
  wedding: { ro: "Nuntă", en: "Wedding" },
  christening: { ro: "Botez", en: "Christening" },
};

/** Every printed item a suite can hold, in the order a suite lists them. */
export const productKinds = [
  "invitation",
  "save-the-date",
  "rsvp",
  "menu",
  "place-card",
  "table-number",
  "welcome-sign",
  "seating-chart",
  "money-envelope",
  "favor-tag",
  "thank-you",
  "bridal-party",
] as const;
export type ProductKind = (typeof productKinds)[number];

export const productKindLabels: Record<ProductKind, Labels> = {
  invitation: { ro: "Invitație", en: "Invitation" },
  "save-the-date": { ro: "Save the date", en: "Save the date" },
  rsvp: { ro: "Card de confirmare", en: "RSVP card" },
  menu: { ro: "Meniu", en: "Menu" },
  "place-card": { ro: "Place card", en: "Place card" },
  "table-number": { ro: "Număr de masă", en: "Table number" },
  "welcome-sign": { ro: "Tablou de întâmpinare", en: "Welcome sign" },
  "seating-chart": { ro: "Tablou de așezare", en: "Seating chart" },
  "money-envelope": { ro: "Plic de bani", en: "Money envelope" },
  "favor-tag": { ro: "Etichetă pentru mărturii", en: "Favour tag" },
  "thank-you": { ro: "Card de mulțumire", en: "Thank-you card" },
  "bridal-party": {
    ro: "Invitație domnișoară de onoare și cavaler",
    en: "Bridesmaid and groomsman card",
  },
};

/**
 * Words a suite is browsed by. Suites may carry others; the studio shows a
 * word it has no label for as it is.
 */
export const suiteStyles = {
  botanic: { ro: "Botanic", en: "Botanical" },
  floral: { ro: "Floral", en: "Floral" },
  minimal: { ro: "Minimalist", en: "Minimal" },
  classic: { ro: "Clasic", en: "Classic" },
  modern: { ro: "Modern", en: "Modern" },
  rustic: { ro: "Rustic", en: "Rustic" },
  boho: { ro: "Boho", en: "Boho" },
  vellum: { ro: "Foaie de calc", en: "Vellum" },
  "wax-seal": { ro: "Cu sigiliu", en: "Wax seal" },
  "gold-foil": { ro: "Folio auriu", en: "Gold foil" },
  premium: { ro: "Premium", en: "Premium" },
  themed: { ro: "Tematic", en: "Themed" },
} as const satisfies Record<string, Labels>;

export function suiteStyleLabel(style: string, language: Language): string {
  return Object.hasOwn(suiteStyles, style)
    ? suiteStyles[style as keyof typeof suiteStyles][language]
    : style;
}

export interface Format {
  width: number;
  height: number;
  labels: Labels;
}

/** Finished (trimmed) sizes in millimetres, portrait. */
export const formats = {
  a6: { width: 105, height: 148, labels: { ro: "A6", en: "A6" } },
  a5: { width: 148, height: 210, labels: { ro: "A5", en: "A5" } },
  dl: { width: 99, height: 210, labels: { ro: "DL", en: "DL" } },
  "120x170": {
    width: 120,
    height: 170,
    labels: { ro: "12 × 17 cm", en: "12 × 17 cm" },
  },
  "5x7": {
    width: 127,
    height: 178,
    labels: { ro: "5 × 7 in", en: "5 × 7 in" },
  },
  square150: {
    width: 150,
    height: 150,
    labels: { ro: "Pătrat 15 cm", en: "Square 15 cm" },
  },
  "place-card": {
    width: 90,
    height: 55,
    labels: { ro: "Place card", en: "Place card" },
  },
  "welcome-50x70": {
    width: 500,
    height: 700,
    labels: { ro: "50 × 70 cm", en: "50 × 70 cm" },
  },
} as const satisfies Record<string, Format>;
export type FormatId = keyof typeof formats;

export const paperTextures = [
  "smooth",
  "cotton",
  "linen",
  "pearl",
  "kraft",
  "vellum",
] as const;
export type PaperTexture = (typeof paperTextures)[number];

export interface Stock {
  labels: Labels;
  /** Weight in grams per square metre. */
  gsm: number;
  texture: PaperTexture;
  /** Vellum ("foaie de calc") lets what is underneath show through. */
  translucent: boolean;
  /** The paper's own colour, used when a design leaves the paper unset. */
  color: string;
}

export const stocks = {
  "cotton-350": {
    labels: { ro: "Hârtie din bumbac 350 g", en: "Cotton paper 350 gsm" },
    gsm: 350,
    texture: "cotton",
    translucent: false,
    color: "#f7f3ea",
  },
  "textured-300": {
    labels: { ro: "Carton texturat 300 g", en: "Textured card 300 gsm" },
    gsm: 300,
    texture: "linen",
    translucent: false,
    color: "#fbf8f1",
  },
  "smooth-300": {
    labels: { ro: "Carton mat 300 g", en: "Smooth matte card 300 gsm" },
    gsm: 300,
    texture: "smooth",
    translucent: false,
    color: "#ffffff",
  },
  "smooth-250": {
    labels: { ro: "Carton mat 250 g", en: "Smooth matte card 250 gsm" },
    gsm: 250,
    texture: "smooth",
    translucent: false,
    color: "#ffffff",
  },
  "pearl-250": {
    labels: { ro: "Carton perlat 250 g", en: "Pearlescent card 250 gsm" },
    gsm: 250,
    texture: "pearl",
    translucent: false,
    color: "#f6f1e7",
  },
  "pearl-300": {
    labels: { ro: "Carton perlat 300 g", en: "Pearlescent card 300 gsm" },
    gsm: 300,
    texture: "pearl",
    translucent: false,
    color: "#f8f6f1",
  },
  "kraft-300": {
    labels: { ro: "Carton kraft 300 g", en: "Kraft card 300 gsm" },
    gsm: 300,
    texture: "kraft",
    translucent: false,
    color: "#c9a77c",
  },
  "vellum-110": {
    labels: { ro: "Foaie de calc 110 g", en: "Vellum 110 gsm" },
    gsm: 110,
    texture: "vellum",
    translucent: true,
    color: "#f4f4f2",
  },
} as const satisfies Record<string, Stock>;
export type StockId = keyof typeof stocks;

/**
 * How a layer goes onto paper. Everything but "print" is a separate plate in
 * the print file, which the workshop runs through its own machine.
 */
export const inks = [
  "print",
  "white",
  "foil-gold",
  "foil-silver",
  "foil-rose-gold",
  "foil-copper",
  "emboss",
  "deboss",
  "spot-uv",
] as const;
export type Ink = (typeof inks)[number];

export const inkLabels: Record<Ink, Labels> = {
  print: { ro: "Tipar color", en: "Colour print" },
  white: { ro: "Cerneală albă", en: "White ink" },
  "foil-gold": { ro: "Folio auriu", en: "Gold foil" },
  "foil-silver": { ro: "Folio argintiu", en: "Silver foil" },
  "foil-rose-gold": { ro: "Folio rose gold", en: "Rose gold foil" },
  "foil-copper": { ro: "Folio cupru", en: "Copper foil" },
  emboss: { ro: "Embosare", en: "Embossing" },
  deboss: { ro: "Presare în relief negativ", en: "Debossing" },
  "spot-uv": { ro: "Lac UV selectiv", en: "Spot UV" },
};

/** Gradient stops that make foil read as metal on screen, darkest first. */
export const foilShades: Record<
  Extract<Ink, `foil-${string}`>,
  readonly [string, string, string]
> = {
  "foil-gold": ["#7f5f22", "#d8bb6c", "#a8853a"],
  "foil-silver": ["#6f7378", "#e3e6ea", "#959a9f"],
  "foil-rose-gold": ["#94564a", "#e8b3a3", "#b87667"],
  "foil-copper": ["#7a4022", "#d99a6e", "#a45f37"],
};

export const waxColors = {
  burgundy: { labels: { ro: "Vișiniu", en: "Burgundy" }, color: "#6e1423" },
  gold: { labels: { ro: "Auriu", en: "Gold" }, color: "#b8913a" },
  ivory: { labels: { ro: "Ivoire", en: "Ivory" }, color: "#ede3cf" },
  sage: { labels: { ro: "Verde salvie", en: "Sage" }, color: "#8a9a7b" },
  navy: { labels: { ro: "Bleumarin", en: "Navy" }, color: "#1f2a44" },
  blush: { labels: { ro: "Roz pudrat", en: "Blush" }, color: "#d8a7a0" },
  black: { labels: { ro: "Negru", en: "Black" }, color: "#1c1c1c" },
  white: { labels: { ro: "Alb", en: "White" }, color: "#f4f1ea" },
} as const satisfies Record<string, { labels: Labels; color: string }>;
export type WaxColor = keyof typeof waxColors;

/**
 * A seal's wax as a colour: one of the waxes above by name, or a colour of
 * its own, as the shop's choices give it (looks.ts).
 */
export function waxHex(color: string): string {
  return Object.hasOwn(waxColors, color)
    ? waxColors[color as WaxColor].color
    : color;
}

export const ribbonMaterials = [
  "satin",
  "chiffon",
  "velvet",
  "lace",
  "twine",
] as const;
export type RibbonMaterial = (typeof ribbonMaterials)[number];

export const ribbonMaterialLabels: Record<RibbonMaterial, Labels> = {
  satin: { ro: "Panglică de satin", en: "Satin ribbon" },
  chiffon: { ro: "Panglică de mătase", en: "Silk chiffon ribbon" },
  velvet: { ro: "Panglică de catifea", en: "Velvet ribbon" },
  lace: { ro: "Dantelă", en: "Lace" },
  twine: { ro: "Sfoară", en: "Twine" },
};

export const envelopeStyles = ["classic", "square-flap", "pocket"] as const;
export type EnvelopeStyle = (typeof envelopeStyles)[number];

/**
 * Typefaces offered in the studio, all from Google Fonts under the SIL Open
 * Font License, which allows print. Each was checked for Romanian (ă â î and
 * ș ț with the comma below) in its font files when it was added; Parisienne,
 * Marcellus, Mrs Saint Delafield, Sacramento, Tangerine, WindSong and Lato are
 * left out because they lack ș and ț. In each category the families run from
 * the most formal to the most relaxed, as the studio's font picker lists them.
 */
export const fontCategories = ["script", "serif", "sans"] as const;
export type FontCategory = (typeof fontCategories)[number];

export interface FontFamily {
  category: FontCategory;
  weights: readonly number[];
  italic: boolean;
}

export const fontFamilies = {
  "Pinyon Script": { category: "script", weights: [400], italic: false },
  "Petit Formal Script": { category: "script", weights: [400], italic: false },
  "Imperial Script": { category: "script", weights: [400], italic: false },
  "Great Vibes": { category: "script", weights: [400], italic: false },
  Ballet: { category: "script", weights: [400], italic: false },
  Corinthia: { category: "script", weights: [400, 700], italic: false },
  "Lavishly Yours": { category: "script", weights: [400], italic: false },
  Italianno: { category: "script", weights: [400], italic: false },
  Ephesis: { category: "script", weights: [400], italic: false },
  Allura: { category: "script", weights: [400], italic: false },
  "Alex Brush": { category: "script", weights: [400], italic: false },
  Birthstone: { category: "script", weights: [400], italic: false },
  "Dancing Script": {
    category: "script",
    weights: [400, 500, 600, 700],
    italic: false,
  },
  "Cormorant Garamond": {
    category: "serif",
    weights: [300, 400, 500, 600, 700],
    italic: true,
  },
  "Cormorant Upright": {
    category: "serif",
    weights: [300, 400, 500, 600, 700],
    italic: false,
  },
  "EB Garamond": {
    category: "serif",
    weights: [400, 500, 600, 700],
    italic: true,
  },
  "Libre Caslon Text": { category: "serif", weights: [400, 700], italic: true },
  "Libre Baskerville": {
    category: "serif",
    weights: [400, 500, 600, 700],
    italic: true,
  },
  "Sorts Mill Goudy": { category: "serif", weights: [400], italic: true },
  "Bodoni Moda": {
    category: "serif",
    weights: [400, 500, 600, 700],
    italic: true,
  },
  "Playfair Display": {
    category: "serif",
    weights: [400, 500, 600, 700],
    italic: true,
  },
  "Gilda Display": { category: "serif", weights: [400], italic: false },
  Bellefair: { category: "serif", weights: [400], italic: false },
  Cinzel: { category: "serif", weights: [400, 500, 600, 700], italic: false },
  "Cinzel Decorative": {
    category: "serif",
    weights: [400, 700, 900],
    italic: false,
  },
  Lora: { category: "serif", weights: [400, 500, 600, 700], italic: true },
  Montserrat: {
    category: "sans",
    weights: [300, 400, 500, 600],
    italic: true,
  },
  Raleway: {
    category: "sans",
    weights: [300, 400, 500, 600, 700],
    italic: true,
  },
  Jost: { category: "sans", weights: [300, 400, 500, 600], italic: true },
  "Josefin Sans": {
    category: "sans",
    weights: [300, 400, 500, 600],
    italic: true,
  },
  "Tenor Sans": { category: "sans", weights: [400], italic: false },
  Questrial: { category: "sans", weights: [400], italic: false },
  Quicksand: {
    category: "sans",
    weights: [300, 400, 500, 600, 700],
    italic: false,
  },
  Comfortaa: {
    category: "sans",
    weights: [300, 400, 500, 600, 700],
    italic: false,
  },
} as const satisfies Record<string, FontFamily>;
export type FontFamilyName = keyof typeof fontFamilies;

export function isFontFamilyName(value: string): value is FontFamilyName {
  return Object.hasOwn(fontFamilies, value);
}
