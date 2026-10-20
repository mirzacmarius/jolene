import type { DesignDocumentInput, Theme } from "@jolene/design";
import { artLayer, type Suite } from "../suite";
import { art } from "./art";

/**
 * Autumn: sunflowers, daisies and autumn flowers in watercolour, a wooden
 * heart and two old lanterns around the invitation, a crate of jars on the
 * table number. Lifted from jolene.ro's photos until Jolene's own files
 * replace them.
 */

const theme = {
  palette: {
    ink: "#241f1d",
    accent: "#5c1808",
    muted: "#8a817a",
    paper: "#ffffff",
    art: "#a0370e",
  },
  text: {
    names: {
      font: "Pinyon Script",
      weight: 400,
      italic: false,
      size: 44,
      lineHeight: 1.2,
      tracking: 0,
      case: "none",
      color: "$ink",
    },
    heading: {
      font: "Josefin Sans",
      weight: 400,
      italic: false,
      size: 9.8,
      lineHeight: 1.2,
      tracking: 150,
      case: "upper",
      color: "$ink",
    },
    body: {
      font: "Libre Caslon Text",
      weight: 400,
      italic: false,
      size: 8.6,
      lineHeight: 1.36,
      tracking: 40,
      case: "none",
      color: "$ink",
    },
    small: {
      font: "Libre Caslon Text",
      weight: 400,
      italic: false,
      size: 7.3,
      lineHeight: 1.65,
      tracking: 40,
      case: "none",
      color: "$ink",
    },
    script: {
      font: "Great Vibes",
      weight: 400,
      italic: false,
      size: 20.5,
      lineHeight: 1.2,
      tracking: 0,
      case: "none",
      color: "$ink",
    },
    monogram: {
      font: "Corinthia",
      weight: 700,
      italic: false,
      size: 30,
      lineHeight: 1,
      tracking: 0,
      case: "none",
      color: "$ink",
    },
  },
} satisfies Theme;

/**
 * The parents' names, a pair Jolene sets as one line: each name leans on a
 * gap in the middle, so the two read together whatever their length.
 */
const parents = {
  size: 8,
  weight: 700,
  tracking: 60,
  case: "upper",
} as const;

/** The day and the year beside the month, in Jolene's heavier figures. */
const dateFigures = {
  font: "Josefin Sans",
  weight: 600,
  size: 16,
  tracking: 60,
} as const;

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
          artLayer("flowers", "autumn-top", art),
          artLayer("heart", "autumn-heart", art),
          artLayer("lantern-left", "autumn-lantern-left", art),
          artLayer("lantern-right", "autumn-lantern-right", art),
          {
            id: "names",
            name: "Numele",
            type: "text",
            style: "names",
            text: "{{partner1}} & {{partner2}}",
            frame: { x: 10, y: 55.2, width: 113, height: 22 },
          },
          {
            id: "together",
            name: "Împreună cu părinții",
            type: "text",
            style: "body",
            text: "Împreună cu părinții noștri,",
            frame: { x: 20, y: 75.5, width: 93, height: 5.5 },
          },
          {
            id: "parents-1",
            name: "Părinții miresei",
            type: "text",
            style: "body",
            overrides: parents,
            align: "right",
            text: "{{partner1Parents}}",
            frame: { x: 10, y: 83.5, width: 53.5, height: 5 },
          },
          {
            id: "parents-2",
            name: "Părinții mirelui",
            type: "text",
            style: "body",
            overrides: parents,
            align: "left",
            text: "{{partner2Parents}}",
            frame: { x: 69.5, y: 83.5, width: 53.5, height: 5 },
          },
          {
            id: "invite",
            name: "Invitația la nuntă",
            type: "text",
            style: "body",
            text: "Vă invităm să ne fiți alături la cel mai important moment\ndin viața noastră.",
            frame: { x: 10, y: 89.8, width: 113, height: 10.5 },
          },
          {
            id: "day",
            name: "Ziua",
            type: "text",
            style: "heading",
            overrides: dateFigures,
            text: "{{date:day}}",
            frame: { x: 34, y: 101.5, width: 15.3, height: 8 },
          },
          {
            id: "month",
            name: "Luna",
            type: "text",
            style: "heading",
            text: "{{date:month}}",
            frame: { x: 48.8, y: 101.5, width: 28, height: 8 },
          },
          {
            id: "year",
            name: "Anul",
            type: "text",
            style: "heading",
            overrides: dateFigures,
            text: "{{date:year}}",
            frame: { x: 78.8, y: 101.5, width: 20, height: 8 },
          },
          {
            id: "date-rules",
            name: "Liniile datei",
            type: "shape",
            shape: "path",
            path: "M0 0V5.2M30 0V5.2",
            stroke: { color: "$muted", width: 0.2 },
            locked: true,
            frame: { x: 47.8, y: 102.8, width: 30, height: 5.2 },
          },
          {
            id: "civil",
            name: "Cununia civilă",
            type: "text",
            style: "body",
            text: "Cununia Civilă se va oficia la {{civilVenue}},",
            frame: { x: 14, y: 111.6, width: 105, height: 4.6 },
          },
          {
            id: "reception",
            name: "Petrecerea",
            type: "text",
            style: "body",
            text: "iar pentru a petrece împreună\nvă invităm la {{receptionVenue}}, începând cu ora {{receptionTime}}.",
            frame: { x: 24, y: 116, width: 85, height: 9.4 },
          },
          {
            id: "closing",
            name: "Încheierea",
            type: "text",
            style: "names",
            overrides: { size: 18.5 },
            text: "Vă așteptăm cu drag!",
            frame: { x: 30, y: 130, width: 73, height: 14 },
          },
          {
            id: "rsvp",
            name: "Confirmarea",
            type: "text",
            style: "small",
            text: "Vă rugăm să ne confirmați prezența\npână pe data de {{rsvpBy:day}} {{rsvpBy:month}} {{rsvpBy:year}},\nla numărul de telefon:\n{{rsvpContact}}",
            frame: { x: 40, y: 145.2, width: 53, height: 19 },
          },
        ],
      },
    },
  ],
  envelope: { style: "classic", color: "#727a4a" },
};

/** The card guests send back, as Jolene sets it beside the invitation. */
const rsvp: DesignDocumentInput = {
  schemaVersion: 1,
  occasion: "wedding",
  kind: "rsvp",
  theme,
  pieces: [
    {
      id: "card",
      role: "card",
      name: "Cardul de confirmare",
      width: 140,
      height: 80,
      stock: "smooth-300",
      front: {
        layers: [
          artLayer("jar", "autumn-jar", art),
          artLayer("flowers", "autumn-sunflower-daisy", art),
          {
            id: "reply-by",
            name: "Termenul",
            type: "text",
            style: "script",
            overrides: { lineHeight: 1.15 },
            text: "Vă rugăm să ne confirmați\nprezența până pe data de\n{{rsvpBy:day}} {{rsvpBy:month}} {{rsvpBy:year}}",
            frame: { x: 45, y: 22.75, width: 65, height: 29 },
          },
          {
            id: "contact",
            name: "Telefonul",
            type: "text",
            style: "body",
            overrides: { size: 14, tracking: 20 },
            text: "{{rsvpContact}}",
            frame: { x: 46, y: 53.5, width: 63, height: 12.5 },
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
          artLayer("sunflowers", "autumn-sunflowers", art),
          artLayer("crate", "autumn-crate", art),
          // Jolene's frame stops where the sunflowers and the crate meet it.
          {
            id: "rule",
            name: "Chenarul",
            type: "shape",
            shape: "path",
            path: "M30.4 0H97.9V111.8M0 32.1V119.1H34.4",
            stroke: { color: "$art", width: 0.75 },
            locked: true,
            frame: { x: 17.6, y: 21.4, width: 97.9, height: 119.1 },
          },
          {
            id: "number",
            name: "Numărul",
            type: "text",
            style: "script",
            overrides: {
              font: "Alex Brush",
              size: 179,
              lineHeight: 1,
              color: "$accent",
            },
            text: "{{tableName}}",
            frame: { x: 20, y: 53.5, width: 93, height: 64 },
          },
        ],
      },
    },
  ],
};

export const autumn: Suite = {
  slug: "autumn",
  name: { ro: "Toamnă", en: "Autumn" },
  description: {
    ro: "Floarea-soarelui, margarete și flori de toamnă în acuarelă, o inimă de lemn și două felinare vechi în jurul invitației; pe numărul de masă, o lădiță cu borcane cu flori.",
    en: "Watercolour sunflowers, daisies and autumn flowers, a wooden heart and two old lanterns around the invitation; on the table number, a crate of jars full of flowers.",
  },
  occasion: "wedding",
  styles: ["floral", "rustic", "themed"],
  sampleFields: {
    partner1: "Ioana",
    partner2: "Radu",
    partner1Parents: "Neagu Gheorghe & Elena",
    partner2Parents: "Toma Vasile & Mirela",
    date: "2027-10-16",
    civilVenue: "Primăria Municipiului Bistrița",
    receptionTime: "17:00",
    receptionVenue: "Casa Castanilor",
    rsvpBy: "2027-10-01",
    rsvpContact: "0744 218 365",
    tableName: "12",
  },
  art,
  templates: [
    {
      slug: "autumn-invitatie",
      document: invitation,
      shopifyProductHandle: "invitatie-nunta-autumn",
    },
    { slug: "autumn-rsvp", document: rsvp },
    {
      slug: "autumn-numar-masa",
      document: tableNumber,
      shopifyProductHandle: "numar-de-masa-autumn",
    },
  ],
};
