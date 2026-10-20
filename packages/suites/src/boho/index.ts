import type { DesignDocumentInput, Theme } from "@jolene/design";
import { artLayer, type Suite } from "../suite";
import { art } from "./art";

/**
 * Boho: a wicker bassinet with a teddy bear under a cloud mobile, between
 * eucalyptus branches, with a church and a laid plate drawn in line for the
 * ceremony and the party. Lifted from jolene.ro's photos until Jolene's own
 * files replace them.
 */

const theme = {
  palette: {
    ink: "#4a4446",
    accent: "#41361a",
    muted: "#7a7477",
    paper: "#ffffff",
    art: "#5f5a5a",
  },
  text: {
    names: {
      font: "Corinthia",
      weight: 400,
      italic: false,
      size: 50,
      lineHeight: 1,
      tracking: 0,
      case: "none",
      color: "$accent",
    },
    heading: {
      font: "Josefin Sans",
      weight: 600,
      italic: false,
      size: 14.5,
      lineHeight: 1.2,
      tracking: 140,
      case: "none",
      color: "$accent",
    },
    body: {
      font: "Josefin Sans",
      weight: 400,
      italic: false,
      size: 8.3,
      lineHeight: 1.23,
      tracking: 60,
      case: "none",
      color: "$ink",
    },
    small: {
      font: "Josefin Sans",
      weight: 300,
      italic: false,
      size: 8,
      lineHeight: 1.38,
      tracking: 50,
      case: "none",
      color: "$muted",
    },
    script: {
      font: "Corinthia",
      weight: 400,
      italic: false,
      size: 28,
      lineHeight: 1.1,
      tracking: 0,
      case: "none",
      color: "$accent",
    },
    monogram: {
      font: "Corinthia",
      weight: 700,
      italic: false,
      size: 24,
      lineHeight: 1,
      tracking: 0,
      case: "none",
      color: "$accent",
    },
  },
} satisfies Theme;

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
          artLayer("mobile", "boho-mobile", art, {
            x: 51.6,
            y: -4.8,
            scale: 0.546,
          }),
          artLayer("branch-left", "boho-branch-left", art),
          artLayer("sprigs-right", "boho-sprigs-right", art),
          artLayer("leaves-corner", "boho-leaves-corner", art),
          artLayer("bassinet", "boho-bassinet", art),
          artLayer("church", "boho-church", art, {}, { tint: "$art" }),
          artLayer("plate", "boho-plate", art, {}, { tint: "$art" }),
          {
            id: "name",
            name: "Numele",
            type: "text",
            style: "names",
            text: "{{child}}",
            frame: { x: 18, y: 34, width: 100, height: 21 },
          },
          {
            id: "date",
            name: "Data",
            type: "text",
            style: "heading",
            text: "{{date:day}} {{date:month}} {{date:year}}",
            frame: { x: 33, y: 56.5, width: 70, height: 6 },
          },
          {
            id: "ceremony-time",
            name: "Ora botezului",
            type: "text",
            style: "body",
            overrides: { weight: 600, tracking: 80 },
            text: "ORA {{ceremonyTime}}",
            frame: { x: 25, y: 82.2, width: 44, height: 4 },
          },
          {
            id: "ceremony-venue",
            name: "Biserica",
            type: "text",
            style: "body",
            text: "{{ceremonyVenue}}\n{{ceremonyAddress}}",
            frame: { x: 25, y: 86, width: 44, height: 12 },
            valign: "top",
          },
          {
            id: "reception-time",
            name: "Ora petrecerii",
            type: "text",
            style: "body",
            overrides: { weight: 600, tracking: 80 },
            text: "ORA {{receptionTime}}",
            frame: { x: 70.2, y: 82.2, width: 44, height: 4 },
          },
          {
            id: "reception-venue",
            name: "Locul petrecerii",
            type: "text",
            style: "body",
            text: "{{receptionVenue}}\n{{receptionAddress}}",
            frame: { x: 70.2, y: 86, width: 44, height: 12 },
            valign: "top",
          },
          {
            id: "rsvp",
            name: "Confirmarea",
            type: "text",
            style: "small",
            text: "Vă rugăm să confirmați participarea dvs. până la data de {{rsvpBy:day}} {{rsvpBy:month}}, la numărul de telefon: {{rsvpContact}}",
            frame: { x: 28, y: 99.55, width: 80, height: 9 },
          },
        ],
      },
    },
  ],
  envelope: { style: "classic", color: "#24454e" },
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
      width: 175,
      height: 100,
      stock: "smooth-300",
      front: {
        layers: [
          artLayer("bassinet", "boho-bassinet-leaves", art),
          artLayer("airplane", "boho-airplane", art),
          artLayer("leaves-right", "boho-leaves-right", art),
          {
            id: "name",
            name: "Numele",
            type: "text",
            style: "names",
            overrides: { size: 40 },
            text: "{{child}}",
            frame: { x: 86, y: 25, width: 71, height: 16 },
          },
          {
            id: "thanks",
            name: "Mulțumirea",
            type: "text",
            style: "body",
            overrides: { size: 10.5, color: "$accent" },
            text: "Vă mulțumim că sunteți alături de noi!",
            frame: { x: 80, y: 65, width: 82, height: 5.5 },
          },
          {
            id: "family",
            name: "Familia",
            type: "text",
            style: "body",
            overrides: { size: 12.5, weight: 500, color: "$accent" },
            text: "FAMILIA",
            frame: { x: 66, y: 84.4, width: 24, height: 5.5 },
            align: "left",
          },
          {
            id: "dots",
            name: "Rândul de completat",
            type: "shape",
            shape: "line",
            stroke: { color: "$accent", width: 0.4, dash: [0.4, 1.6] },
            frame: { x: 87.6, y: 88.4, width: 74.4, height: 0.4 },
          },
        ],
      },
    },
  ],
};

export const boho: Suite = {
  slug: "boho",
  name: { ro: "Boho", en: "Boho" },
  description: {
    ro: "Un pătuț din răchită cu ursuleț sub un norișor cu picături, între ramuri de eucalipt, cu biserica și masa desenate în linie pentru botez și petrecere.",
    en: "A wicker bassinet and a teddy bear under a cloud mobile, between eucalyptus branches, with the church and the table drawn in line for the christening and the party.",
  },
  occasion: "christening",
  styles: ["boho", "botanic"],
  sampleFields: {
    child: "Luca Ștefan",
    parents: "Mihai și Elena Popa",
    godparents: "Andrei și Diana Marin",
    date: "2027-06-05",
    ceremonyTime: "14:00",
    ceremonyVenue: "Biserica Sfântul Gheorghe",
    ceremonyAddress: "Târgoviște",
    receptionTime: "16:00",
    receptionVenue: "Restaurant Casa Verde",
    receptionAddress: "Târgoviște",
    rsvpBy: "2027-05-20",
    rsvpContact: "0722 123 456",
  },
  art,
  templates: [
    {
      slug: "boho-invitatie",
      document: invitation,
      shopifyProductHandle: "invitatie-botez-boho",
    },
    {
      slug: "boho-plic-bani",
      document: moneyEnvelope,
      shopifyProductHandle: "plic-de-bani-botez-boho",
    },
  ],
};
