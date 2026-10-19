import type { Fields } from "./fields";
import type { DesignDocumentInput, Theme } from "./schema";

/**
 * "Eucalipt", a small suite used to seed new deployments and in tests: sage
 * line art, gold-foil names, a vellum overlay closed with a wax seal. Jolene's
 * own designs replace it in the template library.
 */

export const EUCALYPTUS_ASSET = "eucalyptus-sprig";

export const eucaliptTheme = {
  palette: {
    ink: "#3d3a35",
    accent: "#56664a",
    muted: "#77705f",
    paper: "#f7f3ea",
    art: "#76886a",
  },
  text: {
    names: {
      font: "Great Vibes",
      weight: 400,
      italic: false,
      size: 34,
      lineHeight: 1.1,
      tracking: 0,
      case: "none",
      color: "$accent",
    },
    heading: {
      font: "Cormorant Garamond",
      weight: 600,
      italic: false,
      size: 10.5,
      lineHeight: 1.3,
      tracking: 220,
      case: "upper",
      color: "$ink",
    },
    body: {
      font: "Cormorant Garamond",
      weight: 400,
      italic: false,
      size: 11,
      lineHeight: 1.35,
      tracking: 0,
      case: "none",
      color: "$ink",
    },
    small: {
      font: "Montserrat",
      weight: 400,
      italic: false,
      size: 6,
      lineHeight: 1.5,
      tracking: 160,
      case: "upper",
      color: "$muted",
    },
    script: {
      font: "Great Vibes",
      weight: 400,
      italic: false,
      size: 20,
      lineHeight: 1.1,
      tracking: 0,
      case: "none",
      color: "$accent",
    },
    monogram: {
      font: "Cormorant Garamond",
      weight: 500,
      italic: true,
      size: 22,
      lineHeight: 1,
      tracking: 60,
      case: "none",
      color: "$accent",
    },
  },
} satisfies Theme;

const sprig = (
  id: string,
  frame: { x: number; y: number; width: number; height: number },
  flip = false,
) =>
  ({
    id,
    name: "Ramură de eucalipt",
    type: "image",
    asset: EUCALYPTUS_ASSET,
    tint: "$art",
    fit: "contain",
    frame,
    flipY: flip,
    locked: true,
  }) as const;

export const eucaliptInvitation: DesignDocumentInput = {
  schemaVersion: 1,
  occasion: "wedding",
  kind: "invitation",
  theme: eucaliptTheme,
  pieces: [
    {
      id: "card",
      role: "card",
      name: "Invitația",
      width: 120,
      height: 170,
      stock: "cotton-350",
      front: {
        layers: [
          {
            id: "border",
            name: "Chenar",
            type: "shape",
            shape: "rect",
            frame: { x: 6, y: 6, width: 108, height: 158 },
            stroke: { color: "$art", width: 0.25 },
            locked: true,
          },
          sprig("sprig", { x: 30, y: 12, width: 60, height: 22 }),
          {
            id: "parents",
            name: "Părinții",
            type: "text",
            style: "body",
            overrides: { italic: true, size: 10 },
            text: "Împreună cu părinții\n{{partner1Parents}} și {{partner2Parents}}",
            frame: { x: 12, y: 37, width: 96, height: 12 },
          },
          {
            id: "names",
            name: "Numele",
            type: "text",
            style: "names",
            ink: "foil-gold",
            text: "{{partner1}} & {{partner2}}",
            frame: { x: 10, y: 51, width: 100, height: 18 },
          },
          {
            id: "invite",
            name: "Invitația",
            type: "text",
            style: "body",
            text: "vă invită cu drag să le fiți alături\nîn ziua în care își unesc destinele",
            frame: { x: 12, y: 71, width: 96, height: 11 },
          },
          {
            id: "date",
            name: "Data",
            type: "text",
            style: "heading",
            text: "{{date:long}}",
            frame: { x: 10, y: 86, width: 100, height: 7 },
          },
          {
            id: "details",
            name: "Detalii",
            type: "text",
            style: "body",
            overrides: { size: 9.5 },
            text: "Cununia religioasă, ora {{ceremonyTime}}\n{{ceremonyVenue}}\nPetrecerea, ora {{receptionTime}}\n{{receptionVenue}}",
            frame: { x: 12, y: 97, width: 96, height: 24 },
          },
          {
            id: "godparents",
            name: "Nașii",
            type: "text",
            style: "body",
            overrides: { italic: true, size: 9.5 },
            text: "Nași: {{godparents}}",
            frame: { x: 12, y: 121, width: 96, height: 6 },
          },
          {
            id: "rsvp",
            name: "Confirmare",
            type: "text",
            style: "small",
            text: "Confirmare până la {{rsvpBy:short}} · {{rsvpContact}}",
            frame: { x: 12, y: 128.5, width: 96, height: 5 },
          },
          sprig("sprig-bottom", { x: 30, y: 140, width: 60, height: 16 }, true),
        ],
      },
    },
    {
      id: "vellum",
      role: "overlay",
      name: "Foaia de calc",
      width: 120,
      height: 28,
      bleed: 0,
      safeMargin: 3,
      stock: "vellum-110",
      place: { x: 0, y: 136, rotation: 0 },
      front: {
        layers: [
          {
            id: "vellum-date",
            name: "Data pe calc",
            type: "text",
            style: "small",
            text: "{{date:short}}",
            frame: { x: 70, y: 11.5, width: 42, height: 5 },
            align: "right",
          },
        ],
      },
    },
  ],
  accessories: [
    {
      kind: "wax-seal",
      id: "seal",
      color: "sage",
      motif: { kind: "initials", text: "{{monogram}}" },
      diameter: 24,
      x: 60,
      y: 150,
    },
  ],
  envelope: { style: "classic", color: "#efe9dc" },
};

export const eucaliptSaveTheDate: DesignDocumentInput = {
  schemaVersion: 1,
  occasion: "wedding",
  kind: "save-the-date",
  theme: eucaliptTheme,
  pieces: [
    {
      id: "card",
      role: "card",
      width: 105,
      height: 148,
      stock: "cotton-350",
      front: {
        layers: [
          sprig("sprig", { x: 22, y: 14, width: 61, height: 22 }),
          {
            id: "title",
            type: "text",
            style: "script",
            overrides: { size: 30 },
            text: "Save the date",
            frame: { x: 8, y: 40, width: 89, height: 16 },
          },
          {
            id: "names",
            type: "text",
            style: "heading",
            overrides: { size: 12 },
            text: "{{partner1}} & {{partner2}}",
            frame: { x: 8, y: 62, width: 89, height: 8 },
          },
          {
            id: "date",
            type: "text",
            style: "body",
            overrides: { size: 15 },
            ink: "foil-gold",
            text: "{{date:short}}",
            frame: { x: 8, y: 76, width: 89, height: 9 },
          },
          {
            id: "place",
            type: "text",
            style: "small",
            text: "{{receptionVenue}}",
            frame: { x: 8, y: 90, width: 89, height: 5 },
          },
          {
            id: "note",
            type: "text",
            style: "body",
            overrides: { italic: true, size: 9.5 },
            text: "Invitația oficială va urma",
            frame: { x: 8, y: 124, width: 89, height: 6 },
          },
        ],
      },
    },
  ],
};

export const eucaliptPlaceCard: DesignDocumentInput = {
  schemaVersion: 1,
  occasion: "wedding",
  kind: "place-card",
  theme: eucaliptTheme,
  pieces: [
    {
      id: "card",
      role: "card",
      width: 90,
      height: 55,
      stock: "cotton-350",
      front: {
        layers: [
          sprig("sprig", { x: 25, y: 7, width: 40, height: 14 }),
          {
            id: "guest",
            type: "text",
            style: "names",
            overrides: { size: 24 },
            text: "{{guestName}}",
            frame: { x: 6, y: 22, width: 78, height: 14 },
          },
          {
            id: "table",
            type: "text",
            style: "small",
            text: "Masa {{tableName}}",
            frame: { x: 6, y: 40, width: 78, height: 5 },
          },
        ],
      },
    },
  ],
};

export const eucaliptMenu: DesignDocumentInput = {
  schemaVersion: 1,
  occasion: "wedding",
  kind: "menu",
  theme: eucaliptTheme,
  pieces: [
    {
      id: "card",
      role: "card",
      width: 99,
      height: 210,
      stock: "cotton-350",
      front: {
        layers: [
          sprig("sprig", { x: 20, y: 14, width: 59, height: 22 }),
          {
            id: "title",
            type: "text",
            style: "script",
            overrides: { size: 28 },
            text: "Meniu",
            frame: { x: 8, y: 40, width: 83, height: 14 },
          },
          {
            id: "courses",
            type: "text",
            style: "body",
            overrides: { lineHeight: 1.9 },
            text: "{{menu}}",
            frame: { x: 10, y: 62, width: 79, height: 110 },
            valign: "top",
          },
          {
            id: "names",
            type: "text",
            style: "small",
            text: "{{partner1}} & {{partner2}} · {{date:short}}",
            frame: { x: 8, y: 188, width: 83, height: 5 },
          },
        ],
      },
    },
  ],
};

export const eucaliptFields: Fields = {
  partner1: "Ana",
  partner2: "Mihai",
  partner1Parents: "Elena și Ion Marin",
  partner2Parents: "Maria și Vasile Dobre",
  godparents: "Ioana și Andrei Popescu",
  date: "2027-06-12",
  ceremonyTime: "15:00",
  ceremonyVenue: "Biserica Sfântul Nicolae, Iași",
  receptionTime: "19:00",
  receptionVenue: "Restaurant Grădina Verde",
  rsvpBy: "2027-05-15",
  rsvpContact: "0722 123 456",
  menu: "Aperitiv rece\nSupă cremă de ciuperci\nSarmale cu mămăligă\nFile de vită cu legume\nTort de nuntă",
  guestName: "Familia Ionescu",
  tableName: "7",
};

/**
 * Line art for the suite, in one colour so layers can tint it. The seed stores
 * it as the EUCALYPTUS_ASSET file; the studio's welcome page draws it inline.
 */
export const eucalyptusArtwork = {
  key: EUCALYPTUS_ASSET,
  name: "Ramură de eucalipt",
  contentType: "image/svg+xml" as const,
  svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 520 190">
<path d="M16 132Q250 26 504 112" fill="none" stroke="#000" stroke-width="2" stroke-linecap="round"/>
<g transform="translate(56.8 127.4) rotate(17.7)">
<path d="M-18.6 0C-8.3 -12.1 11.1 -10.2 18.6 0C11.1 10.2 -8.3 12.1 -18.6 0Z" fill="#000" fill-opacity="0.50"/>
<path d="M-17.8 0Q0 0.9 15.2 0" fill="none" stroke="#000" stroke-opacity="0.85" stroke-width="0.9"/>
</g>
<g transform="translate(79.6 93.5) rotate(-59.6)">
<path d="M-19.9 0C-9.0 -12.9 11.9 -10.9 19.9 0C11.9 10.9 -9.0 12.9 -19.9 0Z" fill="#000" fill-opacity="0.81"/>
<path d="M-19.1 0Q0 1.0 16.3 0" fill="none" stroke="#000" stroke-opacity="0.85" stroke-width="0.9"/>
</g>
<g transform="translate(119.3 108.5) rotate(23.2)">
<path d="M-21.2 0C-9.6 -13.8 12.8 -11.7 21.2 0C12.8 11.7 -9.6 13.8 -21.2 0Z" fill="#000" fill-opacity="0.68"/>
<path d="M-20.4 0Q0 1.1 17.4 0" fill="none" stroke="#000" stroke-opacity="0.85" stroke-width="0.9"/>
</g>
<g transform="translate(143.9 73.9) rotate(-54.0)">
<path d="M-22.6 0C-10.2 -14.7 13.6 -12.4 22.6 0C13.6 12.4 -10.2 14.7 -22.6 0Z" fill="#000" fill-opacity="0.55"/>
<path d="M-21.7 0Q0 1.1 18.5 0" fill="none" stroke="#000" stroke-opacity="0.85" stroke-width="0.9"/>
</g>
<g transform="translate(182.2 96.3) rotate(28.9)">
<path d="M-23.9 0C-10.8 -15.6 14.4 -13.2 23.9 0C14.4 13.2 -10.8 15.6 -23.9 0Z" fill="#000" fill-opacity="0.86"/>
<path d="M-23.0 0Q0 1.2 19.6 0" fill="none" stroke="#000" stroke-opacity="0.85" stroke-width="0.9"/>
</g>
<g transform="translate(209.1 61.3) rotate(-48.2)">
<path d="M-25.3 0C-11.4 -16.4 15.2 -13.9 25.3 0C15.2 13.9 -11.4 16.4 -25.3 0Z" fill="#000" fill-opacity="0.72"/>
<path d="M-24.3 0Q0 1.3 20.7 0" fill="none" stroke="#000" stroke-opacity="0.85" stroke-width="0.9"/>
</g>
<g transform="translate(245.2 91.0) rotate(34.7)">
<path d="M-26.6 0C-12.0 -17.3 16.0 -14.7 26.6 0C16.0 14.7 -12.0 17.3 -26.6 0Z" fill="#000" fill-opacity="0.59"/>
<path d="M-25.6 0Q0 1.3 21.9 0" fill="none" stroke="#000" stroke-opacity="0.85" stroke-width="0.9"/>
</g>
<g transform="translate(275.3 55.5) rotate(-42.3)">
<path d="M-28.0 0C-12.6 -18.2 16.8 -15.4 28.0 0C16.8 15.4 -12.6 18.2 -28.0 0Z" fill="#000" fill-opacity="0.91"/>
<path d="M-26.9 0Q0 1.4 23.0 0" fill="none" stroke="#000" stroke-opacity="0.85" stroke-width="0.9"/>
</g>
<g transform="translate(306.3 90.5) rotate(40.5)">
<path d="M-26.6 0C-12.0 -17.3 16.0 -14.7 26.6 0C16.0 14.7 -12.0 17.3 -26.6 0Z" fill="#000" fill-opacity="0.77"/>
<path d="M-25.6 0Q0 1.3 21.9 0" fill="none" stroke="#000" stroke-opacity="0.85" stroke-width="0.9"/>
</g>
<g transform="translate(338.0 59.8) rotate(-36.6)">
<path d="M-25.3 0C-11.4 -16.4 15.2 -13.9 25.3 0C15.2 13.9 -11.4 16.4 -25.3 0Z" fill="#000" fill-opacity="0.64"/>
<path d="M-24.3 0Q0 1.3 20.7 0" fill="none" stroke="#000" stroke-opacity="0.85" stroke-width="0.9"/>
</g>
<g transform="translate(366.1 94.2) rotate(46.2)">
<path d="M-23.9 0C-10.8 -15.6 14.4 -13.2 23.9 0C14.4 13.2 -10.8 15.6 -23.9 0Z" fill="#000" fill-opacity="0.50"/>
<path d="M-23.0 0Q0 1.2 19.6 0" fill="none" stroke="#000" stroke-opacity="0.85" stroke-width="0.9"/>
</g>
<g transform="translate(400.8 70.1) rotate(-31.0)">
<path d="M-22.6 0C-10.2 -14.7 13.6 -12.4 22.6 0C13.6 12.4 -10.2 14.7 -22.6 0Z" fill="#000" fill-opacity="0.81"/>
<path d="M-21.7 0Q0 1.1 18.5 0" fill="none" stroke="#000" stroke-opacity="0.85" stroke-width="0.9"/>
</g>
<g transform="translate(426.8 103.7) rotate(51.7)">
<path d="M-21.2 0C-9.6 -13.8 12.8 -11.7 21.2 0C12.8 11.7 -9.6 13.8 -21.2 0Z" fill="#000" fill-opacity="0.68"/>
<path d="M-20.4 0Q0 1.1 17.4 0" fill="none" stroke="#000" stroke-opacity="0.85" stroke-width="0.9"/>
</g>
<g transform="translate(463.8 86.4) rotate(-25.7)">
<path d="M-19.9 0C-9.0 -12.9 11.9 -10.9 19.9 0C11.9 10.9 -9.0 12.9 -19.9 0Z" fill="#000" fill-opacity="0.55"/>
<path d="M-19.1 0Q0 1.0 16.3 0" fill="none" stroke="#000" stroke-opacity="0.85" stroke-width="0.9"/>
</g>
<g transform="translate(488.6 119.1) rotate(56.8)">
<path d="M-18.5 0C-8.3 -12.1 11.1 -10.2 18.5 0C11.1 10.2 -8.3 12.1 -18.5 0Z" fill="#000" fill-opacity="0.86"/>
<path d="M-17.8 0Q0 0.9 15.2 0" fill="none" stroke="#000" stroke-opacity="0.85" stroke-width="0.9"/>
</g>
</svg>`,
};
