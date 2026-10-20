import type { DesignDocumentInput, Theme } from "@jolene/design";
import { artLayer, type Suite } from "../suite";
import { art } from "./art";

/**
 * Carusel: a watercolour carousel with pink canopy and three ponies, trails
 * of little gold stars, and a lilac bow with long ribbons. Lifted from the
 * girl's version on jolene.ro until Jolene's own files replace it.
 */

const theme = {
  palette: {
    ink: "#13234f",
    accent: "#bf7a8c",
    muted: "#59627e",
    paper: "#ffffff",
    art: "#c2a374",
  },
  text: {
    names: {
      font: "Alex Brush",
      weight: 400,
      italic: false,
      size: 24,
      lineHeight: 1.1,
      tracking: 0,
      case: "none",
      color: "$accent",
    },
    heading: {
      font: "Corinthia",
      weight: 400,
      italic: false,
      size: 54,
      lineHeight: 1,
      tracking: 0,
      case: "none",
      color: "$ink",
    },
    body: {
      font: "Libre Caslon Text",
      weight: 400,
      italic: false,
      size: 10,
      lineHeight: 1.45,
      tracking: 70,
      case: "none",
      color: "$ink",
    },
    small: {
      font: "Jost",
      weight: 400,
      italic: false,
      size: 12.5,
      lineHeight: 1.3,
      tracking: 0,
      case: "none",
      color: "$ink",
    },
    script: {
      font: "Great Vibes",
      weight: 400,
      italic: false,
      size: 23,
      lineHeight: 1.1,
      tracking: 0,
      case: "none",
      color: "$ink",
    },
    monogram: {
      font: "Alex Brush",
      weight: 400,
      italic: false,
      size: 20,
      lineHeight: 1,
      tracking: 0,
      case: "none",
      color: "$accent",
    },
  },
} satisfies Theme;

/**
 * Jolene's mockups sit the design 2 mm right of the card's middle; the
 * templates centre it.
 */
const centre = -2;

const invitation: DesignDocumentInput = {
  schemaVersion: 1,
  occasion: "christening",
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
          artLayer("stars", "carusel-stars-swirl", art, {
            x: art["carusel-stars-swirl"].frame.x + centre,
            y: 3.7,
          }),
          artLayer("carousel", "carusel-carousel", art, {
            x: art["carusel-carousel"].frame.x + centre,
            y: 10.1,
          }),
          {
            id: "cover-name",
            name: "Numele pe față",
            type: "text",
            style: "names",
            overrides: { size: 35, color: "$ink" },
            text: "{{child}}",
            frame: { x: 16.5, y: 154, width: 100, height: 17 },
          },
          {
            id: "cover-date",
            name: "Data pe față",
            type: "text",
            style: "small",
            overrides: { tracking: 40 },
            text: "{{date:day}} {{date:month}} {{date:year}}",
            frame: { x: 26.5, y: 172.5, width: 80, height: 6 },
          },
        ],
      },
      back: {
        layers: [
          artLayer("stars-left", "carusel-stars-left", art),
          artLayer("stars-right", "carusel-stars-right", art),
          artLayer("bow", "carusel-bow", art, {
            x: art["carusel-bow"].frame.x + centre,
            y: 12.5,
          }),
          {
            id: "hello",
            name: "Salutul",
            type: "text",
            style: "body",
            text: "Hello! Mă numesc,",
            frame: { x: 26.5, y: 51.5, width: 80, height: 5 },
          },
          {
            id: "name",
            name: "Numele",
            type: "text",
            style: "names",
            overrides: { size: 30 },
            text: "{{child}}",
            frame: { x: 16.5, y: 58, width: 100, height: 13 },
          },
          {
            id: "parents-intro",
            name: "Părinții, introducere",
            type: "text",
            style: "body",
            text: "și împreună cu părinții mei",
            frame: { x: 26.5, y: 73, width: 80, height: 5 },
          },
          {
            id: "parents",
            name: "Părinții",
            type: "text",
            style: "names",
            text: "{{parents}}",
            frame: { x: 16.5, y: 78.8, width: 100, height: 11 },
          },
          {
            id: "godparents-intro",
            name: "Nașii, introducere",
            type: "text",
            style: "body",
            text: "alături de nănuții",
            frame: { x: 26.5, y: 90.5, width: 80, height: 5 },
          },
          {
            id: "godparents",
            name: "Nașii",
            type: "text",
            style: "names",
            text: "{{godparents}},",
            frame: { x: 16.5, y: 97, width: 100, height: 11 },
          },
          {
            id: "date-intro",
            name: "Data, introducere",
            type: "text",
            style: "body",
            text: "vă invit pe data de",
            frame: { x: 26.5, y: 109.2, width: 80, height: 5 },
          },
          {
            id: "day",
            name: "Ziua",
            type: "text",
            style: "small",
            overrides: { size: 24, tracking: 80 },
            align: "right",
            text: "{{date:day}}",
            frame: { x: 22.6, y: 115.5, width: 20.4, height: 8 },
          },
          {
            id: "day-rule",
            name: "Linie",
            type: "shape",
            shape: "rect",
            fill: "$ink",
            frame: { x: 45.3, y: 116.1, width: 0.25, height: 6.8 },
          },
          {
            id: "month",
            name: "Luna",
            type: "text",
            style: "small",
            overrides: { size: 12.5, tracking: 100, case: "upper" },
            text: "{{date:month}}",
            frame: { x: 46.4, y: 116.5, width: 32.4, height: 6 },
          },
          {
            id: "month-rule",
            name: "Linie",
            type: "shape",
            shape: "rect",
            fill: "$ink",
            frame: { x: 79.6, y: 116.1, width: 0.25, height: 6.8 },
          },
          {
            id: "year",
            name: "Anul",
            type: "text",
            style: "small",
            overrides: { size: 24, tracking: 80 },
            align: "left",
            text: "{{date:year}}",
            frame: { x: 82.4, y: 115.5, width: 28, height: 8 },
          },
          {
            id: "ceremony-intro",
            name: "Botezul, introducere",
            type: "text",
            style: "body",
            text: "să mă vedeți cum primesc Taina Sfântului Botez la",
            frame: { x: 11.5, y: 127.2, width: 110, height: 5 },
          },
          {
            id: "ceremony",
            name: "Biserica",
            type: "text",
            style: "body",
            overrides: { weight: 700 },
            text: "{{ceremonyVenue}}, ora {{ceremonyTime}}.",
            frame: { x: 19.5, y: 132.2, width: 94, height: 10.4 },
          },
          {
            id: "party",
            name: "Petrecerea",
            type: "text",
            style: "body",
            text: "Petrecerea va avea loc la",
            frame: { x: 11.5, y: 142.8, width: 110, height: 5 },
          },
          {
            id: "reception",
            name: "Restaurantul",
            type: "text",
            style: "body",
            overrides: { weight: 700 },
            text: "{{receptionVenue}}, începând cu ora {{receptionTime}}.",
            frame: { x: 11.5, y: 147.8, width: 110, height: 5 },
          },
          {
            id: "closing",
            name: "Încheierea",
            type: "text",
            style: "script",
            text: "Vă așteptăm cu drag!",
            frame: { x: 21.5, y: 155.5, width: 90, height: 10 },
          },
          {
            id: "rsvp",
            name: "Confirmarea",
            type: "text",
            style: "body",
            overrides: { size: 9, lineHeight: 1.6 },
            text: "Vă rugăm să ne confirmați prezența până\npe data de {{rsvpBy:short}}.",
            frame: { x: 16.5, y: 167.5, width: 100, height: 11 },
          },
        ],
      },
    },
  ],
  envelope: { style: "classic", color: "#ecd3d9" },
};

const menu: DesignDocumentInput = {
  schemaVersion: 1,
  occasion: "christening",
  kind: "menu",
  theme,
  pieces: [
    {
      id: "card",
      role: "card",
      name: "Meniul",
      width: 130,
      height: 180,
      stock: "smooth-300",
      front: {
        layers: [
          artLayer("stars", "carusel-stars-swirl", art, {
            x: -1.5,
            y: 6,
            scale: 0.95,
          }),
          artLayer("carousel", "carusel-carousel", art, {
            x: -1.5 + (art["carusel-carousel"].frame.x - 0.45) * 0.95,
            y: 6 + (art["carusel-carousel"].frame.y - 5.18) * 0.95,
            scale: 0.95,
          }),
          {
            id: "welcome",
            name: "Bun venit",
            type: "text",
            style: "heading",
            overrides: { size: 50 },
            text: "Bine ați venit!",
            frame: { x: 10, y: 152, width: 110, height: 18 },
          },
        ],
      },
      back: {
        layers: [
          artLayer("stars-left", "carusel-stars-left", art, {
            x: 1,
            y: 0,
            scale: 0.95,
          }),
          artLayer("stars-right", "carusel-stars-right", art, {
            x: 105,
            y: 6,
            scale: 0.95,
          }),
          artLayer("bow", "carusel-bow", art, { x: 6.8, y: 9, scale: 0.94 }),
          {
            id: "title",
            name: "Titlul",
            type: "text",
            style: "heading",
            text: "Meniu",
            frame: { x: 30, y: 39, width: 70, height: 17 },
          },
          {
            id: "courses",
            name: "Felurile",
            type: "text",
            style: "body",
            overrides: { size: 10.5, lineHeight: 1.6, tracking: 20 },
            valign: "top",
            text: "{{menu}}",
            frame: { x: 11, y: 59, width: 108, height: 112 },
          },
        ],
      },
    },
  ],
};

const moneyEnvelope: DesignDocumentInput = {
  schemaVersion: 1,
  occasion: "christening",
  kind: "money-envelope",
  theme,
  pieces: [
    {
      id: "card",
      role: "card",
      name: "Plicul",
      width: 200,
      height: 95,
      stock: "smooth-300",
      front: {
        layers: [
          artLayer("carousel", "carusel-carousel", art, {
            x: 9,
            y: 6,
            scale: 0.58,
          }),
          {
            id: "name",
            name: "Numele",
            type: "text",
            style: "names",
            overrides: { size: 40, color: "$ink" },
            text: "{{child}}",
            frame: { x: 81, y: 4, width: 100, height: 19 },
          },
          artLayer("bow", "carusel-bow", art, { x: 97, y: 27.5, scale: 0.55 }),
          {
            id: "message",
            name: "Mesajul",
            type: "text",
            style: "small",
            overrides: { size: 13 },
            text: "Vă mulțumește pentru prezență și vă urează\npetrecere frumoasă!",
            frame: { x: 76, y: 46.5, width: 110, height: 15 },
          },
          {
            id: "family",
            name: "Familia",
            type: "text",
            style: "heading",
            overrides: { size: 36 },
            align: "right",
            text: "Familia",
            frame: { x: 62, y: 69, width: 36, height: 14 },
          },
          {
            id: "guest-line",
            name: "Numele invitatului",
            type: "shape",
            shape: "line",
            stroke: { color: "$muted", width: 0.3, dash: [0.3, 0.9] },
            frame: { x: 98.5, y: 78.5, width: 83, height: 0.3 },
          },
        ],
      },
    },
  ],
};

export const carusel: Suite = {
  slug: "carusel",
  name: { ro: "Carusel", en: "Carousel" },
  description: {
    ro: "Un carusel în acuarelă cu baldachin roz și trei căluți, dâre de steluțe aurii și o fundiță liliachie cu panglici lungi.",
    en: "A watercolour carousel with a pink canopy and three ponies, trails of little gold stars and a lilac bow with long ribbons.",
  },
  occasion: "christening",
  styles: ["themed"],
  sampleFields: {
    child: "Ilinca Maria",
    parents: "Andreea & Radu",
    godparents: "Ioana & Vlad",
    date: "2027-10-17",
    ceremonyTime: "11:00",
    ceremonyVenue: "Biserica „Nașterea Sfântului Ioan Botezătorul”",
    receptionTime: "18:00",
    receptionVenue: "Restaurantul Cristal",
    rsvpBy: "2027-10-01",
    rsvpContact: "0744 321 654",
    menu: "GUSTARE CALDĂ\nCrispy strips de pui\nSalată de pui cu ciuperci și castraveciori murați\nCiupercuță gratinată\nChifteluțe de dovlecel cu sos tzatziki\nCașcaval afumat și măsline\n\nSARMALE\nSărmăluțe cu carne de porc, mămăliguță,\nsmântână și ardei iute\n\nFEL PRINCIPAL\nCotlet de porc cu sos de ciuperci,\ncartofi gratinați și salată verde\n\nDESERT\nTort și candybar",
    guestName: "Familia Popescu",
    tableName: "3",
  },
  art,
  templates: [
    {
      slug: "carusel-invitatie",
      document: invitation,
      shopifyProductHandle: "invitatie-botez-carusel-girl",
    },
    {
      slug: "carusel-meniu",
      document: menu,
      shopifyProductHandle: "meniu-botez-carusel",
    },
    {
      slug: "carusel-plic-bani",
      document: moneyEnvelope,
      shopifyProductHandle: "plic-de-bani-botez-carusel-girl",
    },
  ],
};
