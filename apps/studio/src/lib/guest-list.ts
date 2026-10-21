import type { Doc } from "@jolene/backend/convex/_generated/dataModel";

/**
 * The couple's guest list worked out from its families: where each family
 * is (not sent, waiting, replied), the counts over the list, the list as a
 * spreadsheet, and families pasted in as lines of text.
 */

export type Household = Doc<"households">;

export const statuses = [
  "coming",
  "not-coming",
  "waiting",
  "not-sent",
] as const;
export type Status = (typeof statuses)[number];

/**
 * Where a family is: their reply, else whether their link has reached them.
 * A family who opened it or added themselves has it, however it was sent.
 */
export function statusOf(household: Household): Status {
  if (household.reply) return household.reply.coming ? "coming" : "not-coming";
  return household.sent || household.openedAt || household.source === "open"
    ? "waiting"
    : "not-sent";
}

/**
 * The counts over the list, of people: invited, coming, not coming and
 * still to reply (their family's places), and the menus chosen.
 */
export function summarize(households: readonly Household[]) {
  let invited = 0;
  let adults = 0;
  let children = 0;
  let notComing = 0;
  let waiting = 0;
  const meals = new Map<string, number>();
  for (const household of households) {
    invited += household.seats;
    const reply = household.reply;
    if (!reply) waiting += household.seats;
    else if (!reply.coming) notComing += household.seats;
    else
      for (const guest of reply.guests) {
        if (guest.child) children++;
        else adults++;
        if (guest.meal) meals.set(guest.meal, (meals.get(guest.meal) ?? 0) + 1);
      }
  }
  return {
    families: households.length,
    invited,
    coming: adults + children,
    adults,
    children,
    notComing,
    waiting,
    meals: [...meals].sort((a, b) => b[1] - a[1]),
  };
}

/** A cell a spreadsheet would run as a formula starts with one of these. */
const FORMULA = /^[=+\-@\t\r]/;
/** A phone number, which may start with + and is safe as it is. */
const PHONE = /^\+?[\d\s().-]+$/;

/**
 * One cell: quoted when it holds the separator, a quote or a line break,
 * and a guest's words that would read as a formula kept as text.
 */
function cell(value: string, separator: string) {
  let text = FORMULA.test(value) && !PHONE.test(value) ? `'${value}` : value;
  if (text.includes(separator) || /["\r\n]/.test(text))
    text = `"${text.replaceAll('"', '""')}"`;
  return text;
}

export interface CsvColumns {
  family: string;
  guest: string;
  child: string;
  meal: string;
  status: string;
  allergies: string;
  message: string;
  phone: string;
  email: string;
  side: string;
  link: string;
  yes: string;
  no: string;
}

/**
 * The list as a spreadsheet: a row for each guest coming, and one for each
 * family who isn't or hasn't replied. Romanian spreadsheets separate cells
 * with semicolons, since the comma marks decimals; English ones with commas.
 * It starts with a byte-order mark, so Excel reads ă, ș and ț as they are.
 */
export function guestListCsv({
  households,
  columns,
  statusLabel,
  sideLabel,
  linkOf,
  separator,
}: {
  households: readonly Household[];
  columns: CsvColumns;
  statusLabel: (status: Status) => string;
  sideLabel: (side: Household["side"]) => string;
  linkOf: (household: Household) => string;
  separator: "," | ";";
}) {
  const rows: string[][] = [
    [
      columns.family,
      columns.guest,
      columns.child,
      columns.meal,
      columns.status,
      columns.allergies,
      columns.message,
      columns.phone,
      columns.email,
      columns.side,
      columns.link,
    ],
  ];
  for (const household of households) {
    const reply = household.reply;
    const family = (guest?: {
      name: string;
      child: boolean;
      meal?: string;
    }) => [
      household.name,
      guest?.name ?? "",
      guest ? (guest.child ? columns.yes : columns.no) : "",
      guest?.meal ?? "",
      statusLabel(statusOf(household)),
      reply?.allergies ?? "",
      reply?.message ?? "",
      household.phone ?? "",
      household.email ?? "",
      sideLabel(household.side),
      linkOf(household),
    ];
    if (reply?.coming && reply.guests.length > 0)
      for (const guest of reply.guests) rows.push(family(guest));
    else rows.push(family());
  }
  return `﻿${rows
    .map((row) => row.map((value) => cell(value, separator)).join(separator))
    .join("\r\n")}\r\n`;
}

/** A family as a pasted line gives it, before it's added. */
export interface PastedFamily {
  name: string;
  seats: number;
  phone?: string;
  email?: string;
  note?: string;
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_PART = /^[+\d\s()./-]+$/;
const SEATS = /^\d{1,2}$/;
/** "Ana și Mihai", "Familia Popescu": more than one person. */
const MANY = /(\s(și|si|and)\s|&|\+|^familia\s|^fam\.|\bfamily\b)/i;

/**
 * Families from pasted lines, one a line, its parts separated by commas,
 * semicolons or a spreadsheet's tabs: the name first, then the number of
 * people, a phone and an email in any order, and anything else as a note.
 * Without a number, a couple or a family counts two and anyone else one.
 */
export function parseFamilies(
  text: string,
  { maxSeats, maxName }: { maxSeats: number; maxName: number },
): PastedFamily[] {
  const families: PastedFamily[] = [];
  for (const line of text.split(/\r?\n/)) {
    const parts = line
      .split(/[\t;,]/)
      .map((part) => part.trim())
      .filter(Boolean);
    const [first, ...rest] = parts;
    if (!first) continue;
    const name = first.slice(0, maxName);
    const family: PastedFamily = {
      name,
      seats: MANY.test(name) ? 2 : 1,
    };
    const notes: string[] = [];
    let counted = false;
    for (const part of rest) {
      if (!counted && SEATS.test(part) && Number(part) >= 1) {
        family.seats = Math.min(maxSeats, Number(part));
        counted = true;
      } else if (!family.email && EMAIL.test(part)) family.email = part;
      else if (
        !family.phone &&
        PHONE_PART.test(part) &&
        part.replace(/\D/g, "").length >= 6
      )
        family.phone = part;
      else notes.push(part);
    }
    if (notes.length > 0) family.note = notes.join(", ").slice(0, 500);
    families.push(family);
  }
  return families;
}
