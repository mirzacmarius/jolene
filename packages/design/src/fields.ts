import type { Labels, Language, Occasion } from "./catalog";
import { type DesignDocument, faceNames } from "./schema";

/**
 * Fields are the couple's details: names, date, venues. A design's text holds
 * tokens such as {{partner1}} or {{date:long}}, and every item in a suite reads
 * the same fields, so the details are typed once.
 */

export const fieldKinds = ["text", "multiline", "date", "time"] as const;
export type FieldKind = (typeof fieldKinds)[number];

export interface FieldDefinition {
  kind: FieldKind;
  labels: Labels;
  /** Shown in an empty input, as an example of what goes there. */
  examples: Labels;
}

const field = (
  kind: FieldKind,
  labels: Labels,
  examples: Labels,
): FieldDefinition => ({ kind, labels, examples });

const shared = {
  date: field(
    "date",
    { ro: "Data", en: "Date" },
    { ro: "2027-06-12", en: "2027-06-12" },
  ),
  godparents: field(
    "text",
    { ro: "Nașii", en: "Godparents" },
    { ro: "Ioana și Mihai Popescu", en: "Ioana and Mihai Popescu" },
  ),
  ceremonyTime: field(
    "time",
    { ro: "Ora slujbei", en: "Ceremony time" },
    { ro: "15:00", en: "15:00" },
  ),
  ceremonyVenue: field(
    "text",
    { ro: "Biserica", en: "Ceremony venue" },
    { ro: "Biserica Sfântul Nicolae", en: "St Nicholas Church" },
  ),
  ceremonyAddress: field(
    "text",
    { ro: "Adresa bisericii", en: "Ceremony address" },
    { ro: "Str. Lăpușneanu 2, Iași", en: "2 Lapusneanu St, Iasi" },
  ),
  receptionTime: field(
    "time",
    { ro: "Ora petrecerii", en: "Reception time" },
    { ro: "19:00", en: "19:00" },
  ),
  receptionVenue: field(
    "text",
    { ro: "Locul petrecerii", en: "Reception venue" },
    { ro: "Restaurant Grădina Verde", en: "Gradina Verde Restaurant" },
  ),
  receptionAddress: field(
    "text",
    { ro: "Adresa petrecerii", en: "Reception address" },
    { ro: "Șos. Păcurari 120, Iași", en: "120 Pacurari Rd, Iasi" },
  ),
  rsvpBy: field(
    "date",
    { ro: "Confirmare până la", en: "Reply by" },
    { ro: "2027-05-15", en: "2027-05-15" },
  ),
  rsvpContact: field(
    "text",
    { ro: "Telefon pentru confirmare", en: "RSVP phone" },
    { ro: "0722 123 456", en: "0722 123 456" },
  ),
  message: field(
    "multiline",
    { ro: "Mesaj", en: "Message" },
    {
      ro: "Cu inimile pline de bucurie, vă invităm să fiți alături de noi",
      en: "With joyful hearts, we invite you to celebrate with us",
    },
  ),
  guestName: field(
    "text",
    { ro: "Numele invitatului", en: "Guest name" },
    { ro: "Familia Ionescu", en: "The Ionescu family" },
  ),
  tableName: field("text", { ro: "Masa", en: "Table" }, { ro: "7", en: "7" }),
  /** Left empty, {{monogram}} is made from the names. */
  monogram: field(
    "text",
    { ro: "Monogramă", en: "Monogram" },
    { ro: "A & M", en: "A & M" },
  ),
} satisfies Record<string, FieldDefinition>;

export const occasionFields = {
  wedding: {
    partner1: field(
      "text",
      { ro: "Mireasa", en: "Bride" },
      { ro: "Ana", en: "Ana" },
    ),
    partner2: field(
      "text",
      { ro: "Mirele", en: "Groom" },
      { ro: "Mihai", en: "Mihai" },
    ),
    partner1Parents: field(
      "text",
      { ro: "Părinții miresei", en: "Bride's parents" },
      { ro: "Elena și Ion Marin", en: "Elena and Ion Marin" },
    ),
    partner2Parents: field(
      "text",
      { ro: "Părinții mirelui", en: "Groom's parents" },
      { ro: "Maria și Vasile Dobre", en: "Maria and Vasile Dobre" },
    ),
    civilTime: field(
      "time",
      { ro: "Ora cununiei civile", en: "Civil ceremony time" },
      { ro: "12:00", en: "12:00" },
    ),
    civilVenue: field(
      "text",
      { ro: "Locul cununiei civile", en: "Civil ceremony venue" },
      { ro: "Primăria Iași", en: "Iasi City Hall" },
    ),
    menu: field(
      "multiline",
      { ro: "Meniu", en: "Menu" },
      { ro: "Aperitiv\nFel principal\nDesert", en: "Starter\nMain\nDessert" },
    ),
    ...shared,
  },
  christening: {
    child: field(
      "text",
      { ro: "Numele copilului", en: "Child's name" },
      { ro: "Sofia", en: "Sofia" },
    ),
    parents: field(
      "text",
      { ro: "Părinții", en: "Parents" },
      { ro: "Ana și Mihai Dobre", en: "Ana and Mihai Dobre" },
    ),
    ...shared,
  },
} as const satisfies Record<Occasion, Record<string, FieldDefinition>>;

export type FieldKey<O extends Occasion = Occasion> =
  keyof (typeof occasionFields)[O];
/** A design's details by field key; dates are YYYY-MM-DD, times HH:MM. */
export type Fields = Partial<Record<string, string>>;

export function fieldsFor(occasion: Occasion): Record<string, FieldDefinition> {
  return occasionFields[occasion];
}

/**
 * The fields with an example in each one left empty, so a design reads as
 * finished before the couple has typed anything. For previews only: proofs
 * and print files use the couple's own fields.
 */
export function previewFields(
  occasion: Occasion,
  language: Language,
  fields: Fields,
): Fields {
  const filled: Fields = {};
  for (const [key, definition] of Object.entries(fieldsFor(occasion))) {
    // The monogram follows the names unless one is typed.
    if (key === "monogram") continue;
    filled[key] = definition.examples[language];
  }
  for (const [key, value] of Object.entries(fields)) {
    if (value?.trim()) filled[key] = value;
  }
  return filled;
}

/** The fields a document's words read, in the order the occasion lists them. */
export function fieldKeysUsed(document: DesignDocument): string[] {
  const used = new Set<string>();
  for (const piece of document.pieces) {
    for (const face of faceNames) {
      for (const layer of piece[face]?.layers ?? []) {
        if (layer.type === "text")
          for (const key of tokensIn(layer.text)) used.add(key);
      }
    }
  }
  for (const accessory of document.accessories) {
    if (accessory.kind === "wax-seal" && accessory.motif.kind === "initials")
      for (const key of tokensIn(accessory.motif.text)) used.add(key);
  }
  return Object.keys(fieldsFor(document.occasion)).filter((key) =>
    used.has(key),
  );
}

/** The longest value each kind of field holds. */
export const fieldLengths: Record<FieldKind, number> = {
  text: 160,
  multiline: 1200,
  date: 10,
  time: 5,
};

/** A real calendar day written YYYY-MM-DD; 2027-02-30 is not one. */
export function isIsoDate(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const [year, month, day] = [
    Number(match[1]),
    Number(match[2]),
    Number(match[3]),
  ];
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

export type FieldProblem = "unknown" | "too-long" | "date" | "time";

/**
 * Why a value can't be saved in a field, or null when it can. An empty value
 * always can: it clears the field.
 */
export function fieldProblem(
  occasion: Occasion,
  key: string,
  value: string,
): FieldProblem | null {
  const definitions = fieldsFor(occasion);
  const definition = Object.hasOwn(definitions, key)
    ? definitions[key]
    : undefined;
  if (!definition) return "unknown";
  if (value === "") return null;
  if (value.length > fieldLengths[definition.kind]) return "too-long";
  if (definition.kind === "date" && !isIsoDate(value)) return "date";
  if (definition.kind === "time" && !TIME_PATTERN.test(value)) return "time";
  return null;
}

/** {{key}} or {{key:format}}. */
const TOKEN_PATTERN =
  /\{\{\s*([a-zA-Z][a-zA-Z0-9]*)\s*(?::\s*([a-z-]+)\s*)?\}\}/g;

/** The fields a text uses, in the order they first appear. */
export function tokensIn(text: string): string[] {
  const keys: string[] = [];
  for (const match of text.matchAll(TOKEN_PATTERN)) {
    const key = match[1] as string;
    if (!keys.includes(key)) keys.push(key);
  }
  return keys;
}

export const dateFormats = [
  "long",
  "short",
  "day",
  "weekday",
  "month",
  "year",
] as const;
export type DateFormat = (typeof dateFormats)[number];

const calendar: Record<Language, { months: string[]; weekdays: string[] }> = {
  ro: {
    months: [
      "ianuarie",
      "februarie",
      "martie",
      "aprilie",
      "mai",
      "iunie",
      "iulie",
      "august",
      "septembrie",
      "octombrie",
      "noiembrie",
      "decembrie",
    ],
    weekdays: [
      "duminică",
      "luni",
      "marți",
      "miercuri",
      "joi",
      "vineri",
      "sâmbătă",
    ],
  },
  en: {
    months: [
      "January",
      "February",
      "March",
      "April",
      "May",
      "June",
      "July",
      "August",
      "September",
      "October",
      "November",
      "December",
    ],
    weekdays: [
      "Sunday",
      "Monday",
      "Tuesday",
      "Wednesday",
      "Thursday",
      "Friday",
      "Saturday",
    ],
  },
};

/**
 * Formats a YYYY-MM-DD date the way an invitation spells it. Spelled out here
 * rather than with Intl, whose output varies between browsers and servers: the
 * print file must say exactly what the couple approved on screen.
 */
export function formatDate(
  isoDate: string,
  format: DateFormat,
  language: Language,
): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate);
  if (!match) return isoDate;
  const [year, month, day] = [
    Number(match[1]),
    Number(match[2]),
    Number(match[3]),
  ];
  const { months, weekdays } = calendar[language];
  const monthName = months[month - 1];
  if (!monthName || day < 1 || day > 31) return isoDate;
  const weekday = weekdays[
    new Date(Date.UTC(year, month - 1, day)).getUTCDay()
  ] as string;
  const two = (n: number) => String(n).padStart(2, "0");
  switch (format) {
    case "long":
      return `${weekday}, ${day} ${monthName} ${year}`;
    case "short":
      return language === "ro"
        ? `${two(day)}.${two(month)}.${year}`
        : `${two(day)}/${two(month)}/${year}`;
    case "day":
      return String(day);
    case "weekday":
      return weekday;
    case "month":
      return monthName;
    case "year":
      return String(year);
  }
}

/** "A & M" from the couple's (or the child's) names. */
export function monogram(fields: Fields, occasion: Occasion): string {
  const initial = (name?: string) => name?.trim().charAt(0).toUpperCase() ?? "";
  if (occasion === "christening") return initial(fields.child);
  const first = initial(fields.partner1);
  const second = initial(fields.partner2);
  return first && second ? `${first} & ${second}` : first || second;
}

export interface ResolveOptions {
  fields: Fields;
  occasion: Occasion;
  language: Language;
}

/**
 * Fills a text's tokens from the fields. A line whose tokens all come out
 * empty is dropped, so "Nașii: {{godparents}}" disappears until nași are
 * named instead of printing a bare label.
 */
export function resolveText(text: string, options: ResolveOptions): string {
  const value = (key: string, format?: string): string => {
    if (key === "monogram")
      return (
        options.fields.monogram?.trim() ||
        monogram(options.fields, options.occasion)
      );
    const raw = options.fields[key]?.trim() ?? "";
    if (!raw) return "";
    if (format && (dateFormats as readonly string[]).includes(format))
      return formatDate(raw, format as DateFormat, options.language);
    return raw;
  };
  return text
    .split("\n")
    .flatMap((line) => {
      let tokens = 0;
      let filled = 0;
      const resolved = line.replace(
        TOKEN_PATTERN,
        (_match, key: string, format?: string) => {
          tokens += 1;
          const replacement = value(key, format);
          if (replacement) filled += 1;
          return replacement;
        },
      );
      return tokens > 0 && filled === 0 ? [] : [resolved];
    })
    .join("\n");
}
