import type { DesignDocumentInput, LayerInput, Theme } from "@jolene/design";
import { artLayer, type Suite } from "../suite";
import { art } from "./art";

/**
 * Geometric Flowers: watercolour peonies, a succulent and a hummingbird
 * around thin gold polygons, on white or on mint. Lifted from jolene.ro's
 * photos until Jolene's own files replace them.
 *
 * The gold lines are paths, so they follow the palette and print sharp at
 * any size; the flowers were lifted with the lines painted out. The table
 * number's bouquet and bird were lifted against their mint ground, so they
 * sit on mint without a pale fringe.
 *
 * Jolene's wreath is half hidden in the one photo of the invitation's front,
 * so it is put together again from the table number's spray and the money
 * envelope's peonies, lifted a second time without their sprig. Those
 * peonies were cut by the envelope's edge, so on the back they sit in the
 * corners, where the card's edge takes the cut.
 */

const mint = "#e9f7ea";

const theme = {
  palette: {
    ink: "#262d52",
    accent: "#1a1a1a",
    muted: "#8c8c8c",
    paper: "#ffffff",
    art: "#c48c4f",
  },
  text: {
    names: {
      font: "Allura",
      weight: 400,
      italic: false,
      size: 40,
      lineHeight: 1.1,
      tracking: 0,
      case: "none",
      color: "$accent",
    },
    heading: {
      font: "Jost",
      weight: 300,
      italic: false,
      size: 30,
      lineHeight: 1,
      tracking: 0,
      case: "none",
      color: "$accent",
    },
    body: {
      font: "Jost",
      weight: 400,
      italic: false,
      size: 8,
      lineHeight: 2.25,
      tracking: 80,
      case: "upper",
      color: "$ink",
    },
    small: {
      font: "Jost",
      weight: 400,
      italic: false,
      size: 7,
      lineHeight: 1.5,
      tracking: 120,
      case: "upper",
      color: "$ink",
    },
    script: {
      font: "Allura",
      weight: 400,
      italic: false,
      size: 22,
      lineHeight: 1.2,
      tracking: 0,
      case: "none",
      color: "$ink",
    },
    monogram: {
      font: "Allura",
      weight: 400,
      italic: false,
      size: 24,
      lineHeight: 1,
      tracking: 0,
      case: "none",
      color: "$accent",
    },
  },
} satisfies Theme;

type Size = { width: number; height: number };

/**
 * A gold polygon on a card of the given size, drawn as the runs of it that
 * show between the flowers, which hide it where it turns.
 */
function goldLine(
  id: string,
  card: Size,
  path: string,
  width = 0.35,
): LayerInput {
  return {
    id,
    name: "Linia aurie",
    type: "shape",
    shape: "path",
    path,
    frame: { x: 0, y: 0, ...card },
    stroke: { color: "$art", width },
    locked: true,
  };
}

/** A white panel cut out of a mint card by a gold polygon. */
function panel(card: Size, outline: string, edge: string): LayerInput[] {
  return [
    {
      id: "panel",
      name: "Fondul alb",
      type: "shape",
      shape: "path",
      path: outline,
      frame: { x: 0, y: 0, ...card },
      fill: "$paper",
      locked: true,
    },
    goldLine("panel-line", card, edge, 0.4),
  ];
}

/** A thin upright rule, as between the day, month and year. */
function rule(id: string, x: number, y: number, height: number): LayerInput {
  return {
    id,
    name: "Linia subțire",
    type: "shape",
    shape: "rect",
    frame: { x, y, width: 0.2, height },
    fill: "$ink",
    locked: true,
  };
}

const invitationCard = { width: 133, height: 184 };

const invitation: DesignDocumentInput = {
  schemaVersion: 1,
  occasion: "wedding",
  kind: "invitation",
  theme,
  pieces: [
    {
      id: "card",
      role: "card",
      name: "Invitația",
      ...invitationCard,
      stock: "smooth-300",
      front: {
        layers: [
          // The wreath: three sprays for its leaves, three bunches of peonies
          // over them, and the hummingbird inside.
          artLayer(
            "wreath-upper-left",
            "geometric-flowers-succulent-bouquet",
            art,
            { x: -3.95, y: 53.97, scale: 0.82 },
            { rotation: -67 },
          ),
          artLayer(
            "wreath-upper-right",
            "geometric-flowers-succulent-bouquet",
            art,
            { x: 69.55, y: 42.2, scale: 0.78 },
            { rotation: -132, flipX: true },
          ),
          artLayer(
            "wreath-bottom",
            "geometric-flowers-succulent-bouquet",
            art,
            { x: 20, y: 110.5, scale: 1.05 },
            { rotation: -8, flipX: true },
          ),
          artLayer(
            "wreath-top",
            "geometric-flowers-peonies",
            art,
            { x: 41.22, y: 22.04, scale: 0.74 },
            { rotation: -68 },
          ),
          artLayer(
            "wreath-right",
            "geometric-flowers-peonies",
            art,
            { x: 91.95, y: 78, scale: 0.64 },
            { rotation: -18, flipX: true },
          ),
          artLayer(
            "wreath-left",
            "geometric-flowers-peonies",
            art,
            { x: 13.47, y: 92.13, scale: 0.55 },
            { rotation: -120, flipX: true },
          ),
          artLayer("hummingbird", "geometric-flowers-hummingbird", art, {
            x: 63,
            y: 99.8,
            scale: 1.37,
          }),
          {
            id: "cover-partner1",
            name: "Mireasa, pe față",
            type: "text",
            style: "names",
            text: "{{partner1}}",
            frame: { x: 22, y: 64, width: 58, height: 16 },
          },
          {
            id: "cover-and",
            name: "„&”, pe față",
            type: "text",
            style: "names",
            overrides: { size: 26 },
            text: "&",
            frame: { x: 62, y: 78.3, width: 16, height: 10.4 },
          },
          {
            id: "cover-partner2",
            name: "Mirele, pe față",
            type: "text",
            style: "names",
            text: "{{partner2}}",
            frame: { x: 42, y: 86, width: 58, height: 16 },
          },
          {
            id: "date",
            name: "Data",
            type: "text",
            style: "small",
            overrides: { size: 15, tracking: 271, color: "$muted" },
            text: "{{date:short}}",
            frame: { x: 21, y: 145.5, width: 91, height: 9 },
          },
        ],
      },
      back: {
        layers: [
          // The decagon around the words, broken by the flowers in two of
          // its corners.
          goldLine(
            "decagon",
            invitationCard,
            "M110.17 37.57L128.8 68.6V117.1L105.2 155.7L66.5 170.7L31.29 157.05M22.03 146.27L4.2 117.1V68.6L27.8 29.3L66.5 14.3L101.01 27.68",
          ),
          // In the corners, where the card's edge takes the cut its
          // envelope left them.
          artLayer(
            "flowers-top",
            "geometric-flowers-peony-cluster",
            art,
            { x: 89.26, y: -6.29, scale: 0.68 },
            { rotation: 90 },
          ),
          artLayer(
            "flowers-bottom",
            "geometric-flowers-peony-cluster",
            art,
            { x: 5.22, y: 140.3, scale: 0.68 },
            { rotation: -90 },
          ),
          {
            id: "opening",
            name: "Începutul",
            type: "text",
            style: "body",
            overrides: { size: 7.5, tracking: 140 },
            text: "Împreună cu familia și prietenii",
            frame: { x: 22, y: 38.3, width: 89, height: 6 },
          },
          {
            id: "partner1",
            name: "Mireasa",
            type: "text",
            style: "names",
            overrides: { size: 38.5, color: "$ink" },
            text: "{{partner1}}",
            frame: { x: 29, y: 47.3, width: 73, height: 15 },
          },
          {
            id: "and",
            name: "„&”",
            type: "text",
            style: "names",
            overrides: { size: 28, color: "$ink" },
            text: "&",
            frame: { x: 54, y: 60.5, width: 24, height: 11 },
          },
          {
            id: "partner2",
            name: "Mirele",
            type: "text",
            style: "names",
            overrides: { size: 38.5, color: "$ink" },
            text: "{{partner2}}",
            frame: { x: 28, y: 70.2, width: 73, height: 15 },
          },
          {
            id: "date-intro",
            name: "Data, introducere",
            type: "text",
            style: "body",
            overrides: { size: 7.5 },
            text: "vor sărbători unirea destinelor pe data de",
            frame: { x: 12, y: 87.8, width: 109, height: 6 },
          },
          {
            id: "month",
            name: "Luna",
            type: "text",
            style: "small",
            overrides: { size: 11, weight: 500, tracking: 60 },
            align: "right",
            text: "{{date:month}}",
            frame: { x: 20, y: 97.2, width: 33.4, height: 7.4 },
          },
          rule("rule-left", 58.1, 97.8, 6.6),
          {
            id: "day",
            name: "Ziua",
            type: "text",
            style: "heading",
            overrides: { size: 21, color: "$ink" },
            text: "{{date:day}}",
            frame: { x: 59.5, y: 96.8, width: 14, height: 8 },
          },
          rule("rule-right", 74.8, 97.8, 6.6),
          {
            id: "year",
            name: "Anul",
            type: "text",
            style: "small",
            overrides: { size: 11, weight: 500, tracking: 60 },
            align: "left",
            text: "{{date:year}}",
            frame: { x: 79.5, y: 97.2, width: 33.4, height: 7.4 },
          },
          {
            id: "details",
            name: "Cununia și petrecerea",
            type: "text",
            style: "body",
            text: "Începând cu ora {{ceremonyTime}} la {{ceremonyVenue}},\nmasa și distracția vor fi la {{receptionVenue}}\nde la ora {{receptionTime}}.",
            frame: { x: 10, y: 108.7, width: 113, height: 20 },
          },
          {
            id: "closing",
            name: "Încheierea",
            type: "text",
            style: "script",
            overrides: { size: 20 },
            text: "Vă așteptăm cu drag!",
            frame: { x: 32, y: 131.3, width: 73, height: 11 },
          },
        ],
      },
    },
  ],
  envelope: { style: "classic", color: "#ffffff" },
};

const tableCard = { width: 133, height: 184 };
/** How far the table number's top sits below where it was on the photo's square card. */
const tableDrop = 20;
const tableNumber: DesignDocumentInput = {
  schemaVersion: 1,
  occasion: "wedding",
  kind: "table-number",
  theme,
  pieces: [
    {
      id: "card",
      role: "card",
      name: "Numărul de masă",
      ...tableCard,
      stock: "smooth-300",
      front: {
        background: mint,
        layers: [
          ...panel(
            tableCard,
            "M-3 112.3L23.92 67.4L66.5 50.6L109.08 67.4L136 112.3V187H-3Z",
            "M-3 112.3L23.92 67.4L33.64 63.57M37.36 62.1L39.96 61.07M42.71 59.99L44.76 59.18M53.92 55.56L56.99 54.35M58.24 53.86L59.73 53.27M85.03 57.91L89.73 59.77M92.57 60.89L109.08 67.4L136 112.3",
          ),
          artLayer("bouquet", "geometric-flowers-succulent-bouquet", art, {
            y: art["geometric-flowers-succulent-bouquet"].frame.y + tableDrop,
          }),
          artLayer("hummingbird", "geometric-flowers-hummingbird", art, {
            y: art["geometric-flowers-hummingbird"].frame.y + tableDrop,
          }),
          {
            id: "table",
            name: "„Masa”",
            type: "text",
            style: "small",
            overrides: { size: 17, tracking: 400, color: "$accent" },
            text: "Masa",
            frame: { x: 30, y: 50.5 + tableDrop, width: 73, height: 9 },
          },
          {
            id: "number",
            name: "Numărul",
            type: "text",
            style: "heading",
            // Jolene's tall, narrow figures.
            overrides: { font: "Josefin Sans", size: 221 },
            text: "{{tableName}}",
            frame: { x: 10, y: 60.7 + tableDrop, width: 113, height: 80 },
          },
        ],
      },
    },
  ],
};

const menuCard = { width: 100, height: 180 };
const menu: DesignDocumentInput = {
  schemaVersion: 1,
  occasion: "wedding",
  kind: "menu",
  theme,
  pieces: [
    {
      id: "card",
      role: "card",
      name: "Meniul",
      ...menuCard,
      stock: "smooth-300",
      front: {
        background: mint,
        layers: [
          ...panel(
            menuCard,
            "M50 17.8L85 31.4L106 66.4V114L85 149L50 162.6L15 149L-6 114V66.4L15 31.4Z",
            "M61.37 22.22L63.24 22.94M67.34 24.54L70.79 25.88M74.47 27.31L76.01 27.91M77.73 28.58L85 31.4L106 66.4V114L85 149L82.37 150.02M80.14 150.89L71.14 154.38M68.35 155.47L64.43 156.99M61.82 158.01L56.74 159.98M44.11 160.31L41.55 159.32M38.57 158.16L34.46 156.56M31.62 155.46L15 149L-6 114V66.4L15 31.4L42.06 20.88",
          ),
          artLayer("bouquet-top", "geometric-flowers-succulent-bouquet", art, {
            x: 5,
            y: -7,
            scale: 1.1,
          }),
          artLayer(
            "bouquet-bottom",
            "geometric-flowers-succulent-bouquet",
            art,
            { x: 5, y: 143, scale: 1.1 },
            { flipX: true },
          ),
          {
            id: "title",
            name: "Titlul",
            type: "text",
            style: "small",
            overrides: { size: 18.5, weight: 500, tracking: 0 },
            text: "Meniu",
            frame: { x: 25, y: 33.7, width: 50, height: 10 },
          },
          {
            id: "courses",
            name: "Felurile",
            type: "text",
            style: "body",
            overrides: {
              size: 9.4,
              weight: 500,
              lineHeight: 1.22,
              tracking: 0,
              case: "none",
            },
            text: "{{menu}}",
            frame: { x: 12, y: 45.8, width: 76, height: 98 },
            valign: "top",
          },
        ],
      },
    },
  ],
};

const placeCard = { width: 90, height: 50 };
const placeCardTemplate: DesignDocumentInput = {
  schemaVersion: 1,
  occasion: "wedding",
  kind: "place-card",
  theme,
  pieces: [
    {
      id: "card",
      role: "card",
      name: "Place card",
      ...placeCard,
      stock: "smooth-300",
      front: {
        layers: [
          goldLine(
            "lines",
            placeCard,
            "M19.55 27.87L8 44.64L8.1 53M56.51 11.96L57.98 12.46M59.77 13.09L64.4 14.69M65.68 15.14L79.31 19.87L92.5 37.7",
            0.26,
          ),
          artLayer("bouquet", "geometric-flowers-bouquet", art),
          {
            id: "guest",
            name: "Numele invitatului",
            type: "text",
            style: "heading",
            overrides: { size: 32, tracking: 60 },
            text: "{{guestName}}",
            frame: { x: 29.6, y: 27.5, width: 58, height: 13 },
          },
        ],
      },
    },
  ],
};

const envelopeCard = { width: 200, height: 100 };
const moneyEnvelope: DesignDocumentInput = {
  schemaVersion: 1,
  occasion: "wedding",
  kind: "money-envelope",
  theme,
  pieces: [
    {
      id: "card",
      role: "card",
      name: "Plicul",
      ...envelopeCard,
      stock: "smooth-300",
      front: {
        layers: [
          goldLine(
            "lines",
            envelopeCard,
            "M46.4 19.55L74.1 5.36L161 11.82L203 42M49.5 22L96.7 0.6L167.6 18.03L202 71.2",
            0.5,
          ),
          // A little into the bleed: the photo's card edge stays off the trim.
          artLayer("peonies", "geometric-flowers-peony-cluster", art, {
            x: -0.35,
          }),
          {
            id: "names",
            name: "Numele",
            type: "text",
            style: "names",
            overrides: { size: 44, color: "$art" },
            text: "{{partner1}} & {{partner2}}",
            frame: { x: 58, y: 23, width: 96, height: 22 },
          },
          {
            id: "message",
            name: "Mesajul",
            type: "text",
            style: "body",
            overrides: {
              size: 13,
              tracking: 35,
              case: "none",
              lineHeight: 1.3,
            },
            text: "Vă mulțumim pentru prezență și vă dorim petrecere frumoasă!",
            frame: { x: 30, y: 55.5, width: 145, height: 9 },
          },
          {
            id: "guest",
            name: "Familia",
            type: "text",
            style: "script",
            overrides: { size: 28, tracking: 40 },
            align: "left",
            text: "Familia",
            frame: { x: 44, y: 77.4, width: 44, height: 16 },
          },
          {
            id: "dots",
            name: "Linia punctată",
            type: "text",
            style: "body",
            overrides: { size: 14, lineHeight: 1, tracking: 170, case: "none" },
            align: "left",
            text: ".......................................",
            frame: { x: 76.1, y: 81, width: 93, height: 10 },
          },
        ],
      },
    },
  ],
};

export const geometricFlowers: Suite = {
  slug: "geometric-flowers",
  name: { ro: "Geometric Flowers", en: "Geometric Flowers" },
  description: {
    ro: "Bujori în acuarelă, o suculentă și un colibri în jurul unor poligoane aurii subțiri, pe alb sau pe verde mentă.",
    en: "Watercolour peonies, a succulent and a hummingbird around thin gold polygons, on white or on mint.",
  },
  occasion: "wedding",
  styles: ["floral", "modern"],
  sampleFields: {
    partner1: "Ema",
    partner2: "David",
    partner1Parents: "Ioana și Mihai Rusu",
    partner2Parents: "Carmen și Dan Ilie",
    godparents: "Andreea și Radu Stan",
    date: "2027-05-22",
    ceremonyTime: "13:00",
    ceremonyVenue: "Biserica Sf. Nicolae",
    receptionTime: "20:00",
    receptionVenue: "Restaurantul Cristal, Iași",
    rsvpBy: "2027-05-01",
    rsvpContact: "0722 123 456",
    menu: "APERITIV\nRoșii și brânză de oaie sărată\nFileu mignon cu creveți\nLegume asortate\n\nGUSTARE CALDĂ\nSărmăluțe cu mămăliguță\nArdei iute\nSmântână\n\nFRIPTURĂ\nCotlet de porc\nPulpe de pui dezosate\nCartofi umpluți\n\nDESERT\nPrăjituri\nTort\n\nBĂUTURI\nApă minerală și plată\nCafea și ceai\nVin roșu și alb\nȘampanie",
    guestName: "Alexandra",
    tableName: "14",
  },
  art,
  templates: [
    {
      slug: "geometric-flowers-invitatie",
      document: invitation,
      shopifyProductHandle: "invitatie-de-nunta-geometric-flowers",
    },
    {
      slug: "geometric-flowers-meniu",
      document: menu,
    },
    {
      slug: "geometric-flowers-place-card",
      document: placeCardTemplate,
      shopifyProductHandle: "place-card-geometric-flower",
    },
    {
      slug: "geometric-flowers-numar-masa",
      document: tableNumber,
      shopifyProductHandle: "numar-de-masa-spring",
    },
    {
      slug: "geometric-flowers-plic-bani",
      document: moneyEnvelope,
      shopifyProductHandle: "plic-bani-nunta-geometric-flowers",
    },
  ],
};
