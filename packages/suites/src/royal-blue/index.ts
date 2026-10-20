import type { DesignDocumentInput, LayerInput, Theme } from "@jolene/design";
import { artLayer, type Suite } from "../suite";
import { art } from "./art";

/**
 * Royal Blue: watercolour peonies on navy, a thin gold hexagon around the
 * words. Lifted from jolene.ro's photos until Jolene's own files replace them.
 *
 * The peonies came off the cards with their navy ground (only white paper
 * can be lifted away), so every card is navy and each bouquet is cut into
 * pieces around the words that sat beside it: `bouquet` lays them side by
 * side again. The hexagon is drawn as a path where it showed between the
 * flowers, so its gold follows the palette.
 */

const theme = {
  palette: {
    ink: "#ffffff",
    accent: "#ffffff",
    muted: "#c3c8d4",
    paper: "#22293a",
    art: "#cdc26a",
  },
  text: {
    names: {
      font: "Great Vibes",
      weight: 400,
      italic: false,
      size: 32,
      lineHeight: 1.1,
      tracking: 0,
      case: "none",
      color: "$accent",
    },
    heading: {
      font: "Libre Caslon Text",
      weight: 400,
      italic: false,
      size: 20,
      lineHeight: 1.1,
      tracking: 20,
      case: "upper",
      color: "$ink",
    },
    body: {
      font: "Libre Caslon Text",
      weight: 400,
      italic: false,
      size: 8,
      lineHeight: 1.5,
      tracking: 0,
      case: "none",
      color: "$ink",
    },
    small: {
      font: "Libre Caslon Text",
      weight: 400,
      italic: false,
      size: 7.5,
      lineHeight: 1.4,
      tracking: 40,
      case: "upper",
      color: "$ink",
    },
    script: {
      font: "Alex Brush",
      weight: 400,
      italic: false,
      size: 16,
      lineHeight: 1.2,
      tracking: 0,
      case: "none",
      color: "$ink",
    },
    monogram: {
      font: "Great Vibes",
      weight: 400,
      italic: false,
      size: 22,
      lineHeight: 1,
      tracking: 0,
      case: "none",
      color: "$accent",
    },
  },
} satisfies Theme;

type ArtKey = keyof typeof art;
type ImageLayer = ReturnType<typeof artLayer>;

const bouquets = {
  /** Deep red peonies across the top, leaves down the left edge. */
  nw: ["royal-blue-peonies-nw", "royal-blue-bud-nw", "royal-blue-leaves-w"],
  /** Deep red peonies along the bottom, leaves up the right edge. */
  se: ["royal-blue-leaves-e", "royal-blue-bud-se", "royal-blue-peonies-se"],
  /** Paler peonies, top right, from the save the date. */
  ne: [
    "royal-blue-pale-peonies-ne",
    "royal-blue-pale-leaves-ne",
    "royal-blue-pale-bud-e",
  ],
  /** Paler peonies, bottom left, from the save the date. */
  sw: ["royal-blue-pale-leaves-sw", "royal-blue-pale-peonies-sw"],
} satisfies Record<string, ArtKey[]>;

const round = (value: number) => Math.round(value * 100) / 100;

/**
 * A bouquet's pieces with its top-left corner at x, y; `scale` grows or
 * shrinks it about that corner. Unplaced, it sits where it was on its card.
 */
function bouquet(
  id: string,
  keys: ArtKey[],
  place: { x?: number; y?: number; scale?: number } = {},
): ImageLayer[] {
  const frames = keys.map((key) => art[key].frame);
  const left = Math.min(...frames.map((frame) => frame.x));
  const top = Math.min(...frames.map((frame) => frame.y));
  const { x = left, y = top, scale = 1 } = place;
  return keys.map((key, index) =>
    artLayer(`${id}-${index + 1}`, key, art, {
      x: round(x + (art[key].frame.x - left) * scale),
      y: round(y + (art[key].frame.y - top) * scale),
      scale,
    }),
  );
}

/** The gold hexagon on a 133 × 184 card, where it showed between the flowers. */
function hexagon(path: string): LayerInput {
  return {
    id: "hexagon",
    name: "Hexagonul auriu",
    type: "shape",
    shape: "path",
    path,
    frame: { x: 0, y: 0, width: 133, height: 184 },
    stroke: { color: "$art", width: 1.1 },
    locked: true,
  };
}

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
      width: 133,
      height: 184,
      stock: "smooth-300",
      front: {
        background: "$paper",
        layers: [
          // A little into the bleed: the photo's card edge stays off the trim.
          ...bouquet("peonies-top", bouquets.nw, { x: -0.4, y: -0.4 }),
          ...bouquet("peonies-bottom", bouquets.se, { x: 26.15, y: 111.15 }),
          hexagon(
            "M78.4 23.9L79.3 24.5M83.6 27L90.3 31M99.2 36.2L125.85 51.92V124.2M125.85 129.5V131.5M4.06 52.5V54.2M4.06 70.2V72M4.06 72.8V75.5M4.06 77.2V81.8M4.06 84V134.3L36.9 155.27M39.7 157.06L42 158.53M50 163.63L51.9 164.85M63.1 172.0L64.1 172.65",
          ),
          {
            id: "opening",
            name: "Începutul",
            type: "text",
            style: "small",
            text: "Din iubire și respect,",
            frame: { x: 43, y: 53.8, width: 47, height: 4 },
          },
          {
            id: "we",
            name: "„noi”",
            type: "text",
            style: "script",
            overrides: { size: 14 },
            text: "noi,",
            frame: { x: 51, y: 57.8, width: 31, height: 5.2 },
          },
          {
            id: "names",
            name: "Numele",
            type: "text",
            style: "names",
            text: "{{partner1}} & {{partner2}}",
            frame: { x: 24, y: 62.6, width: 85, height: 12.4 },
          },
          {
            id: "parents-intro",
            name: "Părinții, introducere",
            type: "text",
            style: "body",
            text: "vă invităm alături de părinții noștri",
            frame: { x: 26, y: 75.4, width: 81, height: 4.2 },
          },
          {
            id: "parents-1",
            name: "Părinții miresei",
            type: "text",
            style: "body",
            overrides: { weight: 700 },
            text: "{{partner1Parents}}",
            frame: { x: 23, y: 79.6, width: 43, height: 4.2 },
          },
          {
            id: "parents-2",
            name: "Părinții mirelui",
            type: "text",
            style: "body",
            overrides: { weight: 700 },
            text: "{{partner2Parents}}",
            frame: { x: 67, y: 79.6, width: 43, height: 4.2 },
          },
          {
            id: "godparents-intro",
            name: "Nașii, introducere",
            type: "text",
            style: "body",
            text: "și nașii",
            frame: { x: 46, y: 84.2, width: 41, height: 4.2 },
          },
          {
            id: "godparents",
            name: "Nașii",
            type: "text",
            style: "script",
            overrides: { size: 17 },
            text: "{{godparents}}",
            frame: { x: 23, y: 88.2, width: 87, height: 7.4 },
          },
          {
            id: "date-intro",
            name: "Data, introducere",
            type: "text",
            style: "body",
            text: "să ne onorați cu prezența pe data de",
            frame: { x: 26, y: 95.6, width: 81, height: 4.2 },
          },
          {
            id: "date",
            name: "Data",
            type: "text",
            style: "small",
            overrides: { size: 8.5, weight: 700 },
            text: "{{date:day}} {{date:month}} {{date:year}}",
            frame: { x: 36, y: 99.8, width: 61, height: 4.4 },
          },
          {
            id: "details",
            name: "Cununia și petrecerea",
            type: "text",
            style: "body",
            overrides: { size: 7.5, lineHeight: 1.45 },
            text: "la celebrarea cununiei religioase\nla {{ceremonyVenue}}, ora {{ceremonyTime}}.\nÎncepând cu ora {{receptionTime}},\nvă așteptăm să petrecem la {{receptionVenue}}.",
            frame: { x: 29, y: 104.4, width: 72, height: 15.6 },
          },
          {
            id: "rsvp",
            name: "Confirmarea",
            type: "text",
            style: "body",
            overrides: { size: 7, lineHeight: 1.4 },
            text: "Vă rugăm ca până la data de {{rsvpBy:day}} {{rsvpBy:month}} {{rsvpBy:year}}\nsă ne confirmați prezența la {{rsvpContact}}",
            frame: { x: 30, y: 120.4, width: 66, height: 7 },
          },
          {
            id: "closing",
            name: "Încheierea",
            type: "text",
            style: "script",
            overrides: { size: 17 },
            text: "Vă așteptăm cu drag!",
            frame: { x: 38, y: 127.6, width: 50, height: 7.5 },
          },
        ],
      },
    },
  ],
  envelope: { style: "classic", color: "#b59a48" },
};

const saveTheDate: DesignDocumentInput = {
  schemaVersion: 1,
  occasion: "wedding",
  kind: "save-the-date",
  theme,
  pieces: [
    {
      id: "card",
      role: "card",
      name: "Save the date",
      width: 133,
      height: 184,
      stock: "smooth-300",
      front: {
        background: "$paper",
        layers: [
          ...bouquet("peonies-top", bouquets.ne),
          ...bouquet("peonies-bottom", bouquets.sw),
          hexagon(
            "M60.4 21.65L57.8 23.2M55 24.86L10.35 51.46V112M123.25 72.2V129.64L83.4 155.05M81.1 156.51L78.6 158.1M73.3 161.48L71.6 162.57",
          ),
          {
            id: "save",
            name: "„Save”",
            type: "text",
            style: "heading",
            align: "right",
            text: "Save",
            frame: { x: 34, y: 53.4, width: 26.5, height: 8.6 },
          },
          {
            id: "the",
            name: "„the”",
            type: "text",
            style: "script",
            overrides: { size: 15 },
            text: "the",
            frame: { x: 60.5, y: 53.4, width: 8.5, height: 8.6 },
          },
          {
            id: "date-word",
            name: "„Date”",
            type: "text",
            style: "heading",
            align: "left",
            text: "Date",
            frame: { x: 69, y: 53.4, width: 27, height: 8.6 },
          },
          {
            id: "names",
            name: "Numele",
            type: "text",
            style: "names",
            overrides: { size: 40 },
            text: "{{partner1}} & {{partner2}}",
            frame: { x: 25, y: 62, width: 83, height: 15.5 },
          },
          {
            id: "announcement",
            name: "Anunțul",
            type: "text",
            style: "small",
            overrides: { size: 9 },
            text: "Ne căsătorim!",
            frame: { x: 40, y: 79.5, width: 53, height: 5.5 },
          },
          {
            id: "month",
            name: "Luna",
            type: "text",
            style: "script",
            overrides: { size: 26 },
            text: "{{date:month}}",
            frame: { x: 33, y: 86.5, width: 67, height: 11 },
          },
          {
            id: "weekday",
            name: "Ziua săptămânii",
            type: "text",
            style: "small",
            align: "right",
            text: "{{date:weekday}}",
            frame: { x: 24, y: 105, width: 31, height: 5 },
          },
          {
            id: "heart",
            name: "Inima",
            type: "shape",
            shape: "path",
            path: "M9 15.4C6.1 12.9 0.7 9.4 0.7 5C0.7 2.4 2.7 0.7 5 0.7C6.8 0.7 8.2 1.8 9 3.3C9.8 1.8 11.2 0.7 13 0.7C15.3 0.7 17.3 2.4 17.3 5C17.3 9.4 11.9 12.9 9 15.4Z",
            frame: { x: 57.5, y: 99.5, width: 18, height: 16 },
            stroke: { color: "$ink", width: 0.3 },
            locked: true,
          },
          {
            id: "day",
            name: "Ziua",
            type: "text",
            style: "heading",
            overrides: { size: 19, tracking: 0 },
            text: "{{date:day}}",
            frame: { x: 58.5, y: 101.6, width: 16, height: 8.5 },
          },
          {
            id: "year",
            name: "Anul",
            type: "text",
            style: "small",
            align: "left",
            text: "{{date:year}}",
            frame: { x: 78, y: 105, width: 31, height: 5 },
          },
          {
            id: "to-follow",
            name: "Invitația va urma",
            type: "text",
            style: "small",
            overrides: { size: 6.5, color: "$muted" },
            text: "Invitația va urma",
            frame: { x: 40, y: 119, width: 53, height: 4.5 },
          },
        ],
      },
    },
  ],
  envelope: { style: "classic", color: "#b59a48" },
};

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
      width: 100,
      height: 200,
      stock: "smooth-300",
      front: {
        background: "$paper",
        layers: [
          ...bouquet("peonies-top", bouquets.nw, {
            x: -1.5,
            y: -15,
            scale: 0.99,
          }),
          ...bouquet("peonies-bottom", bouquets.se, {
            x: 0,
            y: 141,
            scale: 0.94,
          }),
          {
            id: "title",
            name: "Titlul",
            type: "text",
            style: "names",
            overrides: { size: 44 },
            text: "Meniu",
            frame: { x: 18, y: 50, width: 64, height: 17 },
          },
          {
            id: "courses",
            name: "Felurile",
            type: "text",
            style: "body",
            overrides: { size: 8, lineHeight: 1.6 },
            text: "{{menu}}",
            frame: { x: 14, y: 70, width: 72, height: 74 },
            valign: "top",
          },
        ],
      },
    },
  ],
};

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
      width: 200,
      height: 100,
      stock: "smooth-300",
      front: {
        background: "$paper",
        layers: [
          ...bouquet("peonies-left", bouquets.nw, {
            x: -0.5,
            y: -0.5,
            scale: 0.8,
          }),
          ...bouquet("peonies-right", bouquets.se, {
            x: 114.6,
            y: 41.4,
            scale: 0.8,
          }),
          {
            id: "names",
            name: "Numele",
            type: "text",
            style: "names",
            overrides: { size: 30 },
            text: "{{partner1}} & {{partner2}}",
            frame: { x: 70, y: 18, width: 120, height: 16 },
          },
          {
            id: "message",
            name: "Mesajul",
            type: "text",
            style: "body",
            overrides: { size: 10, lineHeight: 1.45 },
            text: "Vă mulțumim pentru prezență și vă dorim\npetrecere frumoasă!",
            frame: { x: 52, y: 40, width: 116, height: 14 },
          },
          {
            id: "guest",
            name: "Familia",
            type: "text",
            style: "script",
            overrides: { size: 19 },
            align: "left",
            text: "Familia ..........................................",
            frame: { x: 20, y: 66, width: 112, height: 11 },
          },
        ],
      },
    },
  ],
};

export const royalBlue: Suite = {
  slug: "royal-blue",
  name: { ro: "Royal Blue", en: "Royal Blue" },
  description: {
    ro: "Bujori în acuarelă pe albastru regal, cu un hexagon auriu în jurul cuvintelor.",
    en: "Watercolour peonies on royal navy, with a thin gold hexagon around the words.",
  },
  occasion: "wedding",
  styles: ["floral", "classic"],
  sampleFields: {
    partner1: "Alina",
    partner2: "Ionuț",
    partner1Parents: "Daniela și Mihai Popa",
    partner2Parents: "Elena și Sorin Tănase",
    godparents: "Cristina și Vlad Marinescu",
    date: "2027-05-22",
    ceremonyTime: "16:00",
    ceremonyVenue: "Biserica Sfântul Nicolae",
    receptionTime: "19:00",
    receptionVenue: "Restaurantul Belvedere",
    rsvpBy: "2027-05-01",
    rsvpContact: "0722 123 456",
    menu: "Aperitiv\nRuladă din piept de curcan cu struguri\nRulou de somon fumé cu brânzeturi\nArdei umplut cu pastă de brânză\n\nGustare caldă\nSărmăluțe în foi de varză\nMămăliguță cu smântână\n\nFelul principal\nCeafă de porc la grătar\nCartofi umpluți\nMurături asortate\n\nDesert\nTort și prăjituri",
    guestName: "Familia Ionescu",
    tableName: "7",
  },
  art,
  templates: [
    {
      slug: "royal-blue-invitatie",
      document: invitation,
      shopifyProductHandle: "invitatie-nunta-royal-blue",
    },
    {
      slug: "royal-blue-save-the-date",
      document: saveTheDate,
      shopifyProductHandle: "save-the-date-royal",
    },
    {
      slug: "royal-blue-meniu",
      document: menu,
      shopifyProductHandle: "meniu-nunta-royal-blue",
    },
    {
      slug: "royal-blue-plic-bani",
      document: moneyEnvelope,
      shopifyProductHandle: "plic-de-bani-royal-blue",
    },
  ],
};
