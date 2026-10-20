import type { DesignDocumentInput, LayerInput, Theme } from "@jolene/design";
import { artLayer, type Suite } from "../suite";
import { art } from "./art";

/**
 * Eucalipt: watercolour eucalyptus in the corners, the words in navy between
 * them. A branch and a sprig with a dark tip leaf frame the stationery (the
 * seating chart shows the branch whole), a hanging cluster tops the table
 * number and the favour tag, and the welcome sign has its own garlands of
 * round leaves. Lifted from jolene.ro's photos until Jolene's own files
 * replace them.
 */

const theme = {
  palette: {
    ink: "#0b1e4f",
    accent: "#0b1e4f",
    muted: "#aab0bb",
    paper: "#ffffff",
    art: "#5e8c76",
  },
  text: {
    names: {
      font: "Josefin Sans",
      weight: 300,
      italic: false,
      size: 28,
      lineHeight: 1.1,
      tracking: 60,
      case: "upper",
      color: "$accent",
    },
    heading: {
      font: "Josefin Sans",
      weight: 300,
      italic: false,
      size: 130,
      lineHeight: 1,
      tracking: 0,
      case: "upper",
      color: "$ink",
    },
    body: {
      font: "Jost",
      weight: 400,
      italic: false,
      size: 8,
      lineHeight: 1.275,
      tracking: 0,
      case: "none",
      color: "$ink",
    },
    small: {
      font: "Jost",
      weight: 500,
      italic: false,
      size: 8,
      lineHeight: 1.5,
      tracking: 30,
      case: "upper",
      color: "$ink",
    },
    script: {
      font: "Alex Brush",
      weight: 400,
      italic: false,
      size: 20,
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
        layers: [
          artLayer(
            "branch-top",
            "eucalipt-branch",
            art,
            { x: 77.7, y: -12, scale: 1.6 },
            { flipX: true },
          ),
          artLayer("branch-bottom", "eucalipt-branch", art, {
            x: -3,
            y: 131,
            scale: 1.6,
          }),
          {
            id: "opening",
            name: "Începutul",
            type: "text",
            style: "small",
            text: "Împreună cu familia și prietenii,",
            frame: { x: 12, y: 44, width: 109, height: 5 },
          },
          {
            id: "partner1",
            name: "Mireasa",
            type: "text",
            style: "names",
            text: "{{partner1}}",
            frame: { x: 8, y: 52.5, width: 117, height: 13 },
          },
          {
            id: "ampersand",
            name: "Și",
            type: "text",
            style: "script",
            overrides: { font: "Great Vibes", size: 23, lineHeight: 1 },
            text: "&",
            frame: { x: 56, y: 64, width: 21, height: 10.6 },
          },
          {
            id: "partner2",
            name: "Mirele",
            type: "text",
            style: "names",
            text: "{{partner2}}",
            frame: { x: 8, y: 76, width: 117, height: 13 },
          },
          {
            id: "godparents-intro",
            name: "Nașii, introducere",
            type: "text",
            style: "small",
            text: "Sub îndrumarea nașilor",
            frame: { x: 12, y: 89.5, width: 109, height: 5 },
          },
          {
            id: "godparents",
            name: "Nașii",
            type: "text",
            style: "script",
            overrides: { font: "Great Vibes", size: 16 },
            text: "{{godparents}}",
            frame: { x: 12, y: 94, width: 109, height: 10 },
          },
          {
            id: "date-intro",
            name: "Data, introducere",
            type: "text",
            style: "small",
            text: "Vor sărbători unirea destinelor pe data de",
            frame: { x: 12, y: 104.5, width: 109, height: 5 },
          },
          {
            id: "month",
            name: "Luna",
            type: "text",
            style: "small",
            overrides: { size: 13.5, tracking: 40 },
            text: "{{date:month}}",
            frame: { x: 13.5, y: 112, width: 40, height: 8 },
            align: "right",
          },
          {
            id: "rule-left",
            name: "Linie",
            type: "shape",
            shape: "line",
            stroke: { color: "$muted", width: 0.25 },
            frame: { x: 54.75, y: 115.5, width: 6.5, height: 1 },
            rotation: 90,
          },
          {
            id: "day",
            name: "Ziua",
            type: "text",
            style: "names",
            overrides: { size: 21, tracking: 0 },
            text: "{{date:day}}",
            frame: { x: 59, y: 111, width: 15, height: 10 },
          },
          {
            id: "rule-right",
            name: "Linie",
            type: "shape",
            shape: "line",
            stroke: { color: "$muted", width: 0.25 },
            frame: { x: 71.75, y: 115.5, width: 6.5, height: 1 },
            rotation: 90,
          },
          {
            id: "year",
            name: "Anul",
            type: "text",
            style: "small",
            overrides: { size: 13.5, tracking: 40 },
            text: "{{date:year}}",
            frame: { x: 79.5, y: 112, width: 40, height: 8 },
            align: "left",
          },
          {
            id: "details",
            name: "Cununia și petrecerea",
            type: "text",
            style: "small",
            overrides: { lineHeight: 2.23 },
            text: "Începând cu ora {{ceremonyTime}} la {{ceremonyVenue}}.\nMasa și distracția vor fi la {{receptionVenue}},\nde la ora {{receptionTime}}.",
            frame: { x: 8, y: 122, width: 117, height: 19.6 },
          },
          {
            id: "rule",
            name: "Linie",
            type: "shape",
            shape: "line",
            stroke: { color: "$muted", width: 0.3 },
            frame: { x: 54, y: 144, width: 25, height: 1 },
          },
          {
            id: "closing",
            name: "Încheierea",
            type: "text",
            style: "script",
            text: "Vă așteptăm cu drag!",
            frame: { x: 37, y: 147, width: 66, height: 11 },
          },
        ],
      },
    },
  ],
  envelope: { style: "classic", color: "#f2efe8" },
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
      width: 90,
      height: 200,
      stock: "smooth-300",
      front: {
        layers: [
          artLayer(
            "sprig-top",
            "eucalipt-sprig",
            art,
            { x: 49.89, y: 31.32, scale: 0.251 },
            { rotation: 34.58 },
          ),
          artLayer(
            "sprig-bottom",
            "eucalipt-sprig",
            art,
            { x: -21.72, y: 139.06, scale: 0.2322 },
            { rotation: -150.19 },
          ),
          {
            id: "title",
            name: "Titlul",
            type: "text",
            style: "names",
            overrides: { size: 24, tracking: 140 },
            text: "Meniu",
            frame: { x: 10, y: 33, width: 70, height: 12 },
          },
          {
            id: "courses",
            name: "Felurile",
            type: "text",
            style: "body",
            text: "{{menu}}",
            frame: { x: 17, y: 49.7, width: 56, height: 112 },
            valign: "top",
          },
        ],
      },
    },
  ],
};

const placeCard: DesignDocumentInput = {
  schemaVersion: 1,
  occasion: "wedding",
  kind: "place-card",
  theme,
  pieces: [
    {
      id: "card",
      role: "card",
      name: "Place cardul",
      width: 90,
      height: 55,
      stock: "smooth-300",
      front: {
        layers: [
          artLayer(
            "sprig",
            "eucalipt-sprig",
            art,
            { x: 60.25, y: -1.72, scale: 0.2483 },
            { rotation: -1.06 },
          ),
          artLayer("branch", "eucalipt-branch", art),
          {
            id: "guest",
            name: "Numele invitatului",
            type: "text",
            style: "script",
            overrides: { size: 36 },
            text: "{{guestName}}",
            frame: { x: 8, y: 14, width: 74, height: 16 },
          },
          {
            id: "table",
            name: "Masa",
            type: "text",
            style: "body",
            overrides: { size: 10, tracking: 100 },
            text: "Masa {{tableName}}",
            frame: { x: 25, y: 34.7, width: 40, height: 5 },
          },
        ],
      },
    },
  ],
};

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
      width: 133,
      height: 184,
      stock: "smooth-300",
      front: {
        layers: [
          artLayer("leaves", "eucalipt-cluster", art, { x: 4.17 }),
          {
            id: "number",
            name: "Numărul",
            type: "text",
            style: "heading",
            overrides: { font: "Jost", weight: 400, size: 178, tracking: -80 },
            text: "{{tableName}}",
            frame: { x: 6.2, y: 61.5, width: 113, height: 65 },
          },
        ],
      },
    },
  ],
};

const welcomeSign: DesignDocumentInput = {
  schemaVersion: 1,
  occasion: "wedding",
  kind: "welcome-sign",
  theme,
  pieces: [
    {
      id: "board",
      role: "card",
      name: "Tabloul",
      width: 500,
      height: 700,
      stock: "smooth-300",
      front: {
        layers: [
          artLayer("leaves-top", "eucalipt-leaves-top", art),
          artLayer("leaf", "eucalipt-leaf", art, { y: 416.6 }),
          artLayer("leaf-small", "eucalipt-leaf-small", art, { y: 482 }),
          artLayer("leaves-bottom", "eucalipt-leaves-bottom", art, {
            y: 543.75,
          }),
          {
            id: "welcome",
            name: "Bun venit",
            type: "text",
            style: "heading",
            overrides: { size: 140 },
            text: "Bine ați venit!",
            frame: { x: 20, y: 253, width: 460, height: 51 },
          },
          {
            id: "names",
            name: "Numele",
            type: "text",
            style: "script",
            overrides: { font: "Corinthia", size: 210, lineHeight: 1 },
            text: "{{partner1}} & {{partner2}}",
            frame: { x: 30, y: 335, width: 440, height: 76 },
          },
          {
            id: "date",
            name: "Data",
            type: "text",
            style: "script",
            overrides: { font: "Corinthia", size: 110, lineHeight: 1 },
            text: "{{date:day}} {{date:month}} {{date:year}}",
            frame: { x: 80, y: 445, width: 340, height: 40 },
          },
        ],
      },
    },
  ],
};

/** A table on the seating chart: its number in script over its guests. */
function seatingTable(
  table: number,
  x: number,
  y: number,
  guests: string[],
): LayerInput[] {
  return [
    {
      id: `table-${table}`,
      name: `Masa ${table}`,
      type: "text",
      style: "script",
      overrides: { size: 62.5 },
      text: `Masa ${table}`,
      frame: { x: x - 72, y: y - 14, width: 144, height: 28 },
    },
    {
      id: `table-${table}-guests`,
      name: `Invitații de la masa ${table}`,
      type: "text",
      style: "body",
      overrides: { size: 27, lineHeight: 1.35 },
      text: guests.join("\n"),
      frame: { x: x - 72, y: y + 21.6, width: 144, height: 66 },
      valign: "top",
    },
  ];
}

const seatingChart: DesignDocumentInput = {
  schemaVersion: 1,
  occasion: "wedding",
  kind: "seating-chart",
  theme,
  pieces: [
    {
      id: "board",
      role: "card",
      name: "Tabloul",
      width: 500,
      height: 700,
      stock: "smooth-300",
      front: {
        layers: [
          artLayer("sprig", "eucalipt-sprig", art),
          artLayer("branch", "eucalipt-branch-long", art, {
            x: -5.8,
            y: 585.2,
          }),
          {
            id: "names",
            name: "Numele",
            type: "text",
            style: "script",
            overrides: { size: 140, lineHeight: 1 },
            text: "{{partner1}} & {{partner2}}",
            frame: { x: 20, y: 90, width: 405, height: 52 },
          },
          ...seatingTable(1, 108, 205, [
            "Andreea și Mihai Popescu",
            "Elena Dobre",
            "Carmen și Vlad Stoica",
            "Irina Munteanu",
            "Bogdan și Ana Ciobanu",
          ]),
          ...seatingTable(2, 260, 205, [
            "Raluca și Dan Moldovan",
            "Simona Tudor",
            "Ovidiu și Lavinia Rusu",
          ]),
          ...seatingTable(3, 405, 205, [
            "Gabriela și Cristian Marin",
            "Laura Enache",
            "Sorin și Daniela Lazăr",
          ]),
          ...seatingTable(4, 108, 325, [
            "Florin și Alina Constantin",
            "Mara și Petru Stan",
            "Ionuț Dumitru",
          ]),
          ...seatingTable(5, 260, 325, [
            "Bunica Elena",
            "Adrian Vlad",
            "Corina, Matei și Sofia Barbu",
            "Cătălin Iordache",
          ]),
          ...seatingTable(6, 405, 325, [
            "Bunicul Gheorghe",
            "Mirela și Victor Pavel",
            "Oana și Liviu Toma",
          ]),
          ...seatingTable(7, 108, 430, [
            "Dana și Marius Ene",
            "Cristina și Paul Neagu",
          ]),
          ...seatingTable(8, 260, 430, [
            "Roxana și Cosmin Ilie",
            "Alexandra și Ștefan Diaconu",
          ]),
          ...seatingTable(9, 405, 430, [
            "Monica Avram",
            "Larisa și Răzvan Badea",
            "Iulia Stanciu",
            "Sergiu și Delia Zamfir",
          ]),
          ...seatingTable(10, 108, 512, [
            "Teodor și Anca Mihăilescu",
            "Ilinca și Dragoș Preda",
          ]),
          ...seatingTable(11, 260, 512, [
            "Valentin Popa",
            "Ana-Maria și Cezar Sima",
            "Camelia și Horia Nedelcu",
          ]),
          ...seatingTable(12, 260, 622, [
            "Petra și Vlad Chirilă",
            "Alexia și Tudor Oprea",
            "Mihaela și Victor Năstase",
          ]),
          ...seatingTable(13, 405, 560, [
            "Sorina Iliescu",
            "Daniela și Robert Lupu",
          ]),
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
        layers: [
          artLayer(
            "sprig",
            "eucalipt-sprig",
            art,
            { x: 72.75, y: 4.84, scale: 0.2154 },
            { rotation: -20.14 },
          ),
          {
            id: "partner1",
            name: "Mireasa",
            type: "text",
            style: "names",
            overrides: { size: 35.5, tracking: 50 },
            text: "{{partner1}}",
            frame: { x: 10, y: 33, width: 80, height: 14 },
            align: "right",
          },
          {
            id: "ampersand",
            name: "Și",
            type: "text",
            style: "script",
            overrides: { font: "Great Vibes", size: 34, lineHeight: 1 },
            text: "&",
            frame: { x: 93, y: 33, width: 18, height: 15 },
          },
          {
            id: "partner2",
            name: "Mirele",
            type: "text",
            style: "names",
            overrides: { size: 35.5, tracking: 50 },
            text: "{{partner2}}",
            frame: { x: 112, y: 33, width: 80, height: 14 },
            align: "left",
          },
          {
            id: "message",
            name: "Mesajul",
            type: "text",
            style: "body",
            overrides: { weight: 500, size: 13 },
            text: "Vă mulțumim pentru prezență și vă dorim petrecere frumoasă!",
            frame: { x: 15, y: 53, width: 170, height: 7 },
          },
          {
            id: "family",
            name: "Familia",
            type: "text",
            style: "script",
            overrides: { font: "Great Vibes", size: 34 },
            text: "Familia",
            frame: { x: 26.5, y: 68, width: 44, height: 15 },
            align: "left",
          },
          {
            id: "family-line",
            name: "Linie",
            type: "shape",
            shape: "line",
            stroke: { color: "$muted", width: 0.35 },
            frame: { x: 66.5, y: 78.5, width: 88.5, height: 1 },
          },
        ],
      },
    },
  ],
};

const favorTag: DesignDocumentInput = {
  schemaVersion: 1,
  occasion: "wedding",
  kind: "favor-tag",
  theme,
  pieces: [
    {
      id: "tag",
      role: "tag",
      name: "Eticheta",
      width: 60,
      height: 60,
      bleed: 2,
      safeMargin: 5,
      stock: "smooth-300",
      shape: { kind: "rect", radius: 30 },
      front: {
        layers: [
          artLayer("leaves", "eucalipt-cluster", art, {
            x: -0.5,
            y: -1,
            scale: 0.5,
          }),
          {
            id: "names",
            name: "Numele",
            type: "text",
            style: "script",
            overrides: { font: "Allura", size: 25 },
            text: "{{partner1}} & {{partner2}}",
            frame: { x: 5, y: 31.5, width: 50, height: 11 },
          },
          {
            id: "date",
            name: "Data",
            type: "text",
            style: "body",
            overrides: { weight: 300, size: 24, lineHeight: 1, tracking: 40 },
            text: "{{date:short}}",
            frame: { x: 7, y: 43.5, width: 46, height: 9 },
          },
        ],
      },
    },
  ],
};

export const eucalipt: Suite = {
  slug: "eucalipt",
  name: { ro: "Eucalipt", en: "Eucalyptus" },
  description: {
    ro: "Rămurele de eucalipt în acuarelă în colțuri și textul în bleumarin, aerisit, între ele.",
    en: "Watercolour eucalyptus sprigs in the corners, with airy navy lettering between them.",
  },
  occasion: "wedding",
  styles: ["botanic", "minimal"],
  sampleFields: {
    partner1: "Teodora",
    partner2: "Andrei",
    godparents: "Radu și Ioana Vasilescu",
    date: "2027-06-12",
    ceremonyTime: "15:00",
    ceremonyVenue: "Biserica Sfântul Nicolae",
    receptionTime: "19:00",
    receptionVenue: "Salonul Magnolia, Iași",
    menu: "APERITIV\n\nRoșii & brânză de oaie sărată\nFilet mignon & creveți\nLegume asortate\n\nGUSTARE CALDĂ\n\nSărmăluțe cu mămăliguță\nArdei iute\nSmântână\n\nFRIPTURĂ\n\nCotlet de porc\nPulpe de pui dezosate\nCartofi umpluți\n\nDESERT\n\nPrăjituri\nTort\n\nBĂUTURI\n\nApă minerală și plată\nCafea & ceai\nVin roșu & alb\nȘampanie",
    guestName: "Maria Ionescu",
    tableName: "15",
  },
  art,
  templates: [
    {
      slug: "eucalipt-invitatie",
      document: invitation,
      shopifyProductHandle: "invitatie-de-nunta-eucalipt",
    },
    {
      slug: "eucalipt-meniu",
      document: menu,
      shopifyProductHandle: "meniu-nunta-eucalipt",
    },
    {
      slug: "eucalipt-place-card",
      document: placeCard,
      shopifyProductHandle: "place-card-eucalipt",
    },
    {
      slug: "eucalipt-numar-masa",
      document: tableNumber,
      shopifyProductHandle: "numar-de-masa-eucalipt",
    },
    {
      slug: "eucalipt-tablou-intampinare",
      document: welcomeSign,
      shopifyProductHandle: "panou-intampinare-invitati-eucalipt",
    },
    {
      slug: "eucalipt-tablou-asezare",
      document: seatingChart,
      shopifyProductHandle: "tablou-asezare-invitati-eucalipt",
    },
    {
      slug: "eucalipt-plic-bani",
      document: moneyEnvelope,
      shopifyProductHandle: "plic-de-bani-eucalipt",
    },
    {
      slug: "eucalipt-eticheta-marturii",
      document: favorTag,
      shopifyProductHandle: "eticheta-marturii-eucalipt",
    },
  ],
};
