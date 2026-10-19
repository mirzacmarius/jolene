import type { DesignDocumentInput, LayerInput, Theme } from "@jolene/design";
import { artLayer, type Suite } from "../suite";
import { art } from "./art";

/**
 * Classic Roses: white watercolour roses and green leaves at the corners of
 * the invitation, a wreath on the menu and the table numbers. Lifted from
 * jolene.ro's photos until Jolene's own files replace them.
 */

const theme = {
  palette: {
    ink: "#262624",
    accent: "#41673f",
    muted: "#6f6f69",
    paper: "#ffffff",
    art: "#4d7a4f",
  },
  text: {
    names: {
      font: "Corinthia",
      weight: 400,
      italic: false,
      size: 54,
      lineHeight: 1.1,
      tracking: 0,
      case: "none",
      color: "$ink",
    },
    heading: {
      font: "Josefin Sans",
      weight: 400,
      italic: false,
      size: 15,
      lineHeight: 1.2,
      tracking: 60,
      case: "upper",
      color: "$ink",
    },
    body: {
      font: "Josefin Sans",
      weight: 400,
      italic: false,
      size: 10,
      lineHeight: 1.3,
      tracking: 0,
      case: "none",
      color: "$ink",
    },
    small: {
      font: "Josefin Sans",
      weight: 400,
      italic: false,
      size: 8.2,
      lineHeight: 1.35,
      tracking: 0,
      case: "none",
      color: "$muted",
    },
    script: {
      font: "Great Vibes",
      weight: 400,
      italic: false,
      size: 17,
      lineHeight: 1.1,
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
 * The invitation's roses where they sat on it, on a 133 mm page starting at
 * `offset`; `mirror` flips them for the right-hand page of the menu.
 */
function corners(prefix: string, offset = 0, mirror = false): LayerInput[] {
  const keys = {
    branch: "classic-roses-branch",
    top: "classic-roses-top",
    "bottom-left": "classic-roses-bottom-left",
    "bottom-right": "classic-roses-bottom-right",
  } as const;
  return Object.entries(keys).map(([id, key]) => {
    const { x, width } = art[key].frame;
    return artLayer(
      `${prefix}-${id}`,
      key,
      art,
      { x: mirror ? offset + 133 - x - width : offset + x },
      { flipX: mirror },
    );
  });
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
        layers: [
          ...corners("roses"),
          {
            id: "verse",
            name: "Versurile",
            type: "text",
            style: "body",
            text: "Tu ești un dar ce veșnic vei rămâne\nca o comoară sfântă-n viața mea,\nPe Dumnezeu îl laud pentru tine\ncăci nu putea ceva mai bun să îmi dea.",
            frame: { x: 18, y: 20, width: 97, height: 20 },
          },
          {
            id: "we",
            name: "Noi",
            type: "text",
            style: "body",
            text: "Noi,",
            frame: { x: 50, y: 42.5, width: 33, height: 6 },
          },
          {
            id: "names",
            name: "Numele",
            type: "text",
            style: "names",
            text: "{{partner1}} & {{partner2}}",
            frame: { x: 10, y: 47.5, width: 113, height: 24 },
          },
          {
            id: "blessing",
            name: "Binecuvântarea",
            type: "text",
            style: "body",
            text: "cu binecuvântarea lui Dumnezeu și a părinților,",
            frame: { x: 12, y: 73, width: 109, height: 6 },
          },
          {
            id: "parents-1",
            name: "Părinții miresei",
            type: "text",
            style: "script",
            text: "{{partner1Parents}}",
            frame: { x: 20, y: 79.5, width: 46, height: 15 },
          },
          {
            id: "parents-2",
            name: "Părinții mirelui",
            type: "text",
            style: "script",
            text: "{{partner2Parents}}",
            frame: { x: 69, y: 79.5, width: 46, height: 15 },
          },
          {
            id: "invite",
            name: "Invitația la cununie",
            type: "text",
            style: "body",
            text: "Avem deosebită plăcere de a vă invita să fiți alături de noi,\nla celebrarea căsătoriei noastre înaintea lui Dumnezeu, care va avea loc:",
            frame: { x: 6, y: 96, width: 121, height: 11 },
          },
          {
            id: "date",
            name: "Data",
            type: "text",
            style: "heading",
            text: "{{date:long}}",
            frame: { x: 10, y: 108, width: 113, height: 8 },
          },
          {
            id: "ceremony",
            name: "Cununia",
            type: "text",
            style: "body",
            text: "începând cu ora {{ceremonyTime}}, la {{ceremonyVenue}}.",
            frame: { x: 7, y: 117, width: 119, height: 6 },
          },
          {
            id: "reception",
            name: "Petrecerea",
            type: "text",
            style: "body",
            text: "Masa și felicitările se vor desfășura la {{receptionVenue}},\nîncepând cu ora {{receptionTime}}.",
            frame: { x: 7, y: 124, width: 119, height: 10.5 },
          },
          {
            id: "closing",
            name: "Încheierea",
            type: "text",
            style: "script",
            overrides: { size: 20 },
            text: "Vă așteptăm cu drag!",
            frame: { x: 30, y: 136, width: 73, height: 11 },
          },
          {
            id: "rsvp",
            name: "Confirmarea",
            type: "text",
            style: "small",
            text: "Vă rugăm să confirmați prezența până la data de\n{{rsvpBy:day}} {{rsvpBy:month}} {{rsvpBy:year}}, la numărul de telefon:\n{{rsvpContact}}",
            frame: { x: 30, y: 149, width: 73, height: 12 },
          },
        ],
      },
    },
  ],
  envelope: { style: "classic", color: "#f3ecd9" },
};

/**
 * A folded menu, 133 × 184 mm closed: one sheet printed on both sides. The
 * outside holds the back cover on the left and the front cover on the right,
 * the inside the courses and the drinks.
 */
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
      width: 266,
      height: 184,
      fold: { orientation: "vertical", at: 133 },
      stock: "smooth-300",
      front: {
        layers: [
          artLayer("bouquet", "classic-roses-bouquet", art, { x: 37 }),
          {
            id: "farewell",
            name: "Urarea",
            type: "text",
            style: "script",
            overrides: { size: 24 },
            text: "Vă dorim petrecere frumoasă!",
            frame: { x: 12, y: 58, width: 109, height: 13 },
          },
          artLayer("wreath-top", "classic-roses-wreath-top", art, {
            x: 151.5,
          }),
          artLayer("wreath-bottom", "classic-roses-wreath-bottom", art, {
            x: 150.5,
          }),
          {
            id: "title",
            name: "Titlul",
            type: "text",
            style: "heading",
            overrides: { size: 29, tracking: 0 },
            text: "Meniu",
            frame: { x: 153, y: 72, width: 93, height: 12.5 },
          },
          {
            id: "names",
            name: "Numele",
            type: "text",
            style: "names",
            overrides: { size: 39 },
            text: "{{partner1}} & {{partner2}}",
            frame: { x: 145, y: 87, width: 109, height: 16 },
          },
        ],
      },
      back: {
        layers: [
          ...corners("left"),
          ...corners("right", 133, true),
          {
            id: "courses",
            name: "Felurile",
            type: "text",
            style: "body",
            overrides: { font: "EB Garamond", size: 10.5, lineHeight: 1.5 },
            text: "{{menu}}",
            frame: { x: 17, y: 44, width: 99, height: 98 },
          },
          {
            id: "bar-title",
            name: "Titlul băuturilor",
            type: "text",
            style: "script",
            overrides: { size: 26 },
            text: "Open Bar",
            frame: { x: 166, y: 24, width: 67, height: 13 },
          },
          {
            id: "drinks",
            name: "Băuturile",
            type: "text",
            style: "body",
            overrides: { font: "EB Garamond", size: 10.5, lineHeight: 1.5 },
            text: "Băuturi alcoolice\nWhisky, vodcă, gin\nAperol Spritz, Hugo Spritz\nCremă de whisky\nVin alb, roze și roșu sec sau demisec\nBere\n\nBăuturi răcoritoare\nApă minerală și plată\nCoca-Cola, Fanta, Sprite\nApă tonică\nSuc natural\n\nShot-uri\nTequila, Jägermeister\n\nCafea",
            frame: { x: 150, y: 42, width: 99, height: 100 },
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
      width: 155,
      height: 155,
      stock: "smooth-300",
      front: {
        layers: [
          {
            id: "rule",
            name: "Chenarul",
            type: "shape",
            shape: "path",
            path: "M41 0H0V127.5H31M98 127.5H129V0H88",
            stroke: { color: "$muted", width: 0.3 },
            locked: true,
            frame: { x: 13, y: 11.5, width: 129, height: 127.5 },
          },
          artLayer("wreath-top", "classic-roses-wreath-top", art, {
            x: 34.3,
            y: 20,
            scale: 0.86,
          }),
          artLayer("wreath-bottom", "classic-roses-wreath-bottom", art, {
            x: 33.4,
            y: 75.9,
            scale: 0.86,
          }),
          {
            id: "table",
            name: "Masa",
            type: "text",
            style: "names",
            overrides: { size: 56 },
            text: "Masa",
            frame: { x: 45, y: 1, width: 65, height: 19 },
          },
          {
            id: "number",
            name: "Numărul",
            type: "text",
            style: "heading",
            overrides: {
              font: "Bodoni Moda",
              weight: 500,
              size: 140,
              lineHeight: 1,
              tracking: 0,
            },
            text: "{{tableName}}",
            frame: { x: 20, y: 47, width: 115, height: 46 },
          },
          {
            id: "names",
            name: "Numele",
            type: "text",
            style: "names",
            overrides: { size: 36 },
            text: "{{partner1}} & {{partner2}}",
            frame: { x: 44, y: 131, width: 67, height: 15 },
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
        layers: [
          artLayer("wreath-top", "classic-roses-wreath-top", art, {
            x: -2.15,
            y: 5,
            scale: 0.85,
          }),
          artLayer("wreath-bottom", "classic-roses-wreath-bottom", art, {
            x: -3,
            y: 60.25,
            scale: 0.85,
          }),
          {
            id: "names",
            name: "Numele",
            type: "text",
            style: "names",
            overrides: { size: 34, lineHeight: 0.95 },
            text: "{{partner1}}\n&\n{{partner2}}",
            frame: { x: 4, y: 32, width: 76, height: 40 },
          },
          {
            id: "message",
            name: "Mesajul",
            type: "text",
            style: "body",
            overrides: { size: 12.5 },
            text: "Vă mulțumim pentru prezență\nși petrecere frumoasă!",
            frame: { x: 92, y: 37, width: 92, height: 15 },
          },
          {
            id: "guest",
            name: "Familia",
            type: "text",
            style: "script",
            overrides: { size: 20 },
            text: "Familia ..............................................",
            frame: { x: 85, y: 74, width: 110, height: 13 },
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
      height: 56,
      bleed: 2,
      safeMargin: 6,
      stock: "smooth-300",
      shape: {
        kind: "die",
        path: "M30 56C22 49 4 37 1.3 23 -1 10 8 1.5 17 1.5 23 1.5 27.5 4.5 30 9 32.5 4.5 37 1.5 43 1.5 52 1.5 61 10 58.7 23 56 37 38 49 30 56Z",
      },
      front: {
        layers: [
          artLayer("leaves", "classic-roses-branch", art, {
            x: 0,
            y: 4,
            scale: 0.5,
          }),
          artLayer("roses-top", "classic-roses-top", art, {
            x: -3,
            y: -2,
            scale: 0.6,
          }),
          artLayer("roses-bottom", "classic-roses-bottom-left", art, {
            x: 18,
            y: 33,
            scale: 0.62,
          }),
          {
            id: "message",
            name: "Mesajul",
            type: "text",
            style: "script",
            overrides: { size: 11.5 },
            text: "Totul crește cu dragoste!",
            frame: { x: 6, y: 18.5, width: 48, height: 8 },
          },
          {
            id: "names",
            name: "Numele",
            type: "text",
            style: "script",
            overrides: { size: 14 },
            text: "{{partner1}} și {{partner2}}",
            frame: { x: 8, y: 26.5, width: 44, height: 8 },
          },
        ],
      },
    },
  ],
};

/**
 * A column of the seating chart: each letter, then its guests and their
 * tables, as plain text the couple edits.
 */
function seatingColumn(
  column: string,
  x: number,
  groups: [letter: string, guests: string[]][],
): LayerInput[] {
  const line = 19 * 0.3528 * 1.7;
  const layers: LayerInput[] = [];
  let y = 122;
  for (const [letter, guests] of groups) {
    const id = `${column}-${letter.toLowerCase()}`;
    const height = guests.length * line;
    layers.push(
      {
        id,
        name: `Litera ${letter}`,
        type: "text",
        style: "heading",
        overrides: { size: 58, weight: 600, lineHeight: 1, tracking: 0 },
        align: "left",
        text: letter,
        frame: { x, y, width: 40, height: 19 },
      },
      {
        id: `${id}-guests`,
        name: `Invitații, litera ${letter}`,
        type: "text",
        style: "body",
        overrides: { size: 19, lineHeight: 1.7 },
        align: "left",
        valign: "top",
        text: guests.join("\n"),
        frame: { x, y: y + 19, width: 135, height },
      },
    );
    y += 19 + height + 7;
  }
  return layers;
}

/** Sample guests, as Jolene sets them: by letter, each with their table. */
const guests: Record<
  "left" | "middle" | "right",
  [letter: string, guests: string[]][]
> = {
  left: [
    [
      "A",
      [
        "Albu Costel și Mirela masa 7",
        "Anghel Victor și Raluca masa 12",
        "Ardeleanu Mircea și Lavinia masa 13",
        "Avram Florin masa 4",
      ],
    ],
    [
      "B",
      [
        "Bălănescu Cornel și Simona masa 8",
        "Bârsan Laurențiu și Ana masa 3",
        "Bejan Valentin masa 9",
        "Bogdan Ionuț și Larisa masa 15",
        "Botezatu Marcel și Rodica masa 16",
        "Bucur Sorin și Elena masa 6",
        "Bunea Tudor și Alina masa 10",
        "Burlacu Ștefan masa 2",
      ],
    ],
    [
      "C",
      [
        "Cazacu Gelu și Monica masa 4",
        "Chirilă Dan masa 15",
        "Ciobanu Andrei și Irina masa 5",
        "Constantin Dragoș și Ioana masa 11",
        "Cozma Eduard și Teodora masa 9",
        "Crăciun Mihai și Simona masa 1",
        "Cristea Paul masa 14",
      ],
    ],
    [
      "D",
      [
        "Diaconu Costin și Roxana masa 7",
        "Dinu Alexandru și Bianca masa 13",
        "Dobrescu Gheorghe și Lucia masa 11",
        "Drăgan Costel și Flavia masa 1",
        "Dragomir Radu masa 16",
        "Dumitrescu Liviu și Carmen masa 4",
      ],
    ],
    [
      "F",
      [
        "Filip Octavian masa 12",
        "Florea Cosmin și Alexandra masa 2",
        "Fodor Tiberiu și Ana masa 9",
        "Frunză Eugen și Ilinca masa 6",
      ],
    ],
    [
      "G",
      [
        "Gavrilă Nicu și Ramona masa 6",
        "Georgescu Adrian și Monica masa 7",
        "Gheorghe Alin masa 5",
        "Ghiță Dan masa 12",
        "Grigore Bogdan și Lavinia masa 3",
        "Grosu Vlad și Teodora masa 11",
      ],
    ],
  ],
  middle: [
    [
      "H",
      [
        "Hanganu Petru masa 14",
        "Hogea Romeo și Adriana masa 7",
        "Husar Ovidiu și Delia masa 5",
      ],
    ],
    [
      "I",
      [
        "Ilie Nicolae și Liliana masa 5",
        "Ionescu Gabriel și Cristina masa 15",
        "Ioniță Marcel masa 16",
        "Iordache Valeria masa 8",
        "Istrate Sergiu și Paula masa 1",
        "Ivan Sorin și Gabriela masa 3",
      ],
    ],
    [
      "L",
      [
        "Lazăr Bogdan masa 11",
        "Lăzărescu Nelu și Rodica masa 6",
        "Luca Remus masa 3",
        "Lungu Vasile și Maria masa 14",
        "Lupu Horia și Adina masa 10",
      ],
    ],
    [
      "M",
      [
        "Manole Marius și Cristiana masa 13",
        "Marinescu Ionel și Geta masa 1",
        "Matei Răzvan și Corina masa 6",
        "Mazilu Petre și Viorica masa 8",
        "Mihăilă Toma masa 9",
        "Mitrea Cezar și Flavia masa 4",
        "Mocanu Silviu și Daria masa 2",
        "Moldovan Horia și Andreea masa 16",
        "Munteanu Florin și Ioana masa 11",
        "Murariu Iulian masa 12",
      ],
    ],
    [
      "N",
      [
        "Neagu Petru și Liliana masa 8",
        "Nedelcu Aurel și Sanda masa 13",
        "Nichita Lucian masa 9",
        "Niculescu Lucian și Corina masa 2",
        "Nistor Emil masa 7",
      ],
    ],
    [
      "O",
      [
        "Oancea Viorel și Cornelia masa 2",
        "Olaru Dan masa 16",
        "Olteanu Radu și Elisabeta masa 15",
        "Onu Cătălin masa 10",
        "Oprea Mihai și Ileana masa 4",
      ],
    ],
  ],
  right: [
    [
      "P",
      [
        "Pană Gelu și Corina masa 11",
        "Pârvu Marcel și Ioana masa 13",
        "Pavel Adrian și Irina masa 3",
        "Petrescu Ovidiu masa 5",
        "Pintea Romulus masa 6",
        "Pop Aurora masa 14",
        "Popa Valentin și Cristiana masa 9",
        "Preda Marian și Gina masa 10",
      ],
    ],
    [
      "R",
      [
        "Radu Ciprian și Oana masa 6",
        "Rădoi Silviu și Ilinca masa 10",
        "Roman Stelian și Doina masa 1",
        "Rotaru Emil masa 15",
        "Rusu Alin și Daniela masa 12",
      ],
    ],
    [
      "S",
      [
        "Sandu Florin și Medeea masa 16",
        "Șerban Victor și Elena masa 5",
        "Sima Bogdan și Lorena masa 7",
        "Stan Viorel și Teodora masa 13",
        "Stanciu Felix și Valeria masa 16",
        "Stoica Aurel masa 3",
        "Suciu Cristian masa 4",
      ],
    ],
    [
      "T",
      [
        "Tănase Corina masa 2",
        "Tănăsescu Doru și Mariana masa 8",
        "Toader Gelu și Valentina masa 15",
        "Tudor Matei masa 4",
        "Tudose Marian și Lia masa 11",
      ],
    ],
    [
      "V",
      [
        "Voicu Petru și Diana masa 14",
        "Vlad Sorin masa 12",
        "Vrânceanu Doru și Nela masa 1",
      ],
    ],
  ],
};

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
      safeMargin: 10,
      stock: "smooth-300",
      front: {
        layers: [
          artLayer("roses-top-left", "classic-roses-board-top-left", art),
          artLayer(
            "roses-bottom-right",
            "classic-roses-board-bottom-right",
            art,
            {
              y: 595.2,
            },
          ),
          {
            id: "welcome",
            name: "Bun venit",
            type: "text",
            style: "heading",
            overrides: { size: 82, tracking: 0 },
            text: "Bine ați venit!",
            frame: { x: 110, y: 13, width: 280, height: 35 },
          },
          {
            id: "names",
            name: "Numele",
            type: "text",
            style: "names",
            overrides: { size: 100, weight: 700 },
            text: "{{partner1}} & {{partner2}}",
            frame: { x: 110, y: 46, width: 280, height: 42 },
          },
          {
            id: "date",
            name: "Data",
            type: "text",
            style: "heading",
            overrides: { size: 45, weight: 600, tracking: 120 },
            text: "{{date:day}} {{date:month}} {{date:year}}",
            frame: { x: 130, y: 92, width: 240, height: 17 },
          },
          ...seatingColumn("left", 44, guests.left),
          ...seatingColumn("middle", 189, guests.middle),
          ...seatingColumn("right", 337, guests.right),
        ],
      },
    },
  ],
};

export const classicRoses: Suite = {
  slug: "classic-roses",
  name: { ro: "Classic Roses", en: "Classic Roses" },
  description: {
    ro: "Trandafiri albi în acuarelă și frunze verzi la colțurile invitației, o coroniță pe meniu și pe numerele de masă.",
    en: "White watercolour roses and green leaves at the invitation's corners, a wreath on the menu and the table numbers.",
  },
  occasion: "wedding",
  styles: ["floral", "botanic", "classic"],
  sampleFields: {
    partner1: "Maria",
    partner2: "Andrei",
    partner1Parents: "Vasile & Carmen Rusu",
    partner2Parents: "Dorin & Mariana Ciobanu",
    date: "2027-08-28",
    ceremonyTime: "15:00",
    ceremonyVenue: "Biserica Sfântul Nicolae din Rădăuți",
    receptionTime: "19:00",
    receptionVenue: "Restaurantul Casa Florilor",
    rsvpBy: "2027-08-10",
    rsvpContact: "0745 123 456",
    menu: "Aperitiv\nSpumă de brânză pe pat de castravete\nSomon afumat cu guacamole și roșii uscate\nFrigărui de roșii cherry cu mozzarella\nProsciutto cu pepene galben\n\nPește\nPăstrăv în crustă crocantă cu sos de lămâie\n\nGustare caldă\nSărmăluțe în foi de varză cu mămăliguță\n\nFel principal\nCeafă de porc la grătar și piept de pui cu busuioc\nCartofi țărănești și salată de legume\n\nDesert\nTort și candy-bar",
    guestName: "Familia Popescu",
    tableName: "12",
  },
  art,
  templates: [
    {
      slug: "classic-roses-invitatie",
      document: invitation,
      shopifyProductHandle: "invitatie-de-nunta-classic-roses",
    },
    {
      slug: "classic-roses-meniu",
      document: menu,
      shopifyProductHandle: "meniu-nunta-classic-roses",
    },
    {
      slug: "classic-roses-numar-masa",
      document: tableNumber,
      shopifyProductHandle: "numar-de-masa-classic-roses",
    },
    {
      slug: "classic-roses-plic-bani",
      document: moneyEnvelope,
      shopifyProductHandle: "plic-de-bani-classic-roses",
    },
    {
      slug: "classic-roses-eticheta-marturii",
      document: favorTag,
      shopifyProductHandle: "eticheta-marturii-classic-roses",
    },
    {
      slug: "classic-roses-tablou-asezare",
      document: seatingChart,
      shopifyProductHandle: "tablou-asezare-invitati-classic-roses",
    },
  ],
};
