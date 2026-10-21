import { describe, expect, test } from "bun:test";
import type { Id } from "@jolene/backend/convex/_generated/dataModel";
import {
  type CsvColumns,
  guestListCsv,
  type Household,
  parseFamilies,
  statusOf,
  summarize,
} from "./guest-list";

let next = 0;
function household(overrides: Partial<Household> = {}): Household {
  next++;
  return {
    _id: `household${next}` as Id<"households">,
    _creationTime: next,
    inviteId: "invite" as Id<"invites">,
    name: `Familia ${next}`,
    code: `code${next}`,
    seats: 2,
    plusOne: false,
    source: "couple",
    updatedAt: next,
    ...overrides,
  } as Household;
}

const yes = (guests: { name: string; child?: boolean; meal?: string }[]) => ({
  coming: true,
  guests: guests.map((guest) => ({ child: false, ...guest })),
  at: 1,
  by: "guest" as const,
});
const no = { coming: false, guests: [], at: 1, by: "guest" as const };

describe("statusOf", () => {
  test("goes by the reply, then by whether the link reached the family", () => {
    expect(statusOf(household({ reply: yes([{ name: "Ana" }]) }))).toBe(
      "coming",
    );
    expect(statusOf(household({ reply: no }))).toBe("not-coming");
    expect(statusOf(household({ sent: { by: "whatsapp", at: 1 } }))).toBe(
      "waiting",
    );
    expect(statusOf(household({ openedAt: 1 }))).toBe("waiting");
    expect(statusOf(household({ source: "open" }))).toBe("waiting");
    expect(statusOf(household())).toBe("not-sent");
  });
});

describe("summarize", () => {
  test("counts people invited, coming, not and still to reply, and their menus", () => {
    const summary = summarize([
      household({
        seats: 3,
        reply: yes([
          { name: "Ion", meal: "Pește" },
          { name: "Maria", meal: "Vegetarian" },
          { name: "Andrei", child: true, meal: "Pește" },
        ]),
      }),
      household({ seats: 2, reply: no }),
      household({ seats: 1 }),
    ]);
    expect(summary).toEqual({
      families: 3,
      invited: 6,
      coming: 3,
      adults: 2,
      children: 1,
      notComing: 2,
      waiting: 1,
      meals: [
        ["Pește", 2],
        ["Vegetarian", 1],
      ],
    });
  });
});

describe("guestListCsv", () => {
  const columns: CsvColumns = {
    family: "Familie",
    guest: "Invitat",
    child: "Copil",
    meal: "Meniu",
    status: "Răspuns",
    allergies: "Alergii",
    message: "Mesaj",
    phone: "Telefon",
    email: "Email",
    side: "Invitații cui",
    link: "Link",
    yes: "da",
    no: "nu",
  };
  const csv = (households: Household[], separator: "," | ";" = ";") =>
    guestListCsv({
      households,
      columns,
      statusLabel: (status) => status,
      sideLabel: (side) => side ?? "",
      linkOf: (family) => `https://invitatie.jolene.ro/ana/${family.code}`,
      separator,
    });

  test("starts with a byte-order mark and the column names", () => {
    const text = csv([]);
    expect(text.startsWith("﻿Familie;Invitat;Copil;Meniu;")).toBe(true);
    expect(text.endsWith("\r\n")).toBe(true);
  });

  test("gives each guest coming a row, and other families one", () => {
    const rows = csv([
      household({
        name: "Popescu",
        code: "a",
        phone: "+40 722 123 456",
        reply: { ...yes([{ name: "Ion" }, { name: "Ana", child: true }]) },
      }),
      household({ name: "Dobre", code: "b", reply: no }),
    ])
      .slice(1)
      .trim()
      .split("\r\n");
    expect(rows).toEqual([
      "Familie;Invitat;Copil;Meniu;Răspuns;Alergii;Mesaj;Telefon;Email;Invitații cui;Link",
      "Popescu;Ion;nu;;coming;;;+40 722 123 456;;;https://invitatie.jolene.ro/ana/a",
      "Popescu;Ana;da;;coming;;;+40 722 123 456;;;https://invitatie.jolene.ro/ana/a",
      "Dobre;;;;not-coming;;;;;;https://invitatie.jolene.ro/ana/b",
    ]);
  });

  test("quotes cells that need it and keeps formulas as text", () => {
    const text = csv(
      [
        household({
          name: 'Ionescu, "Nașii"',
          reply: { ...no, message: "=HYPERLINK(1)\nPa" },
        }),
      ],
      ",",
    );
    expect(text).toContain('"Ionescu, ""Nașii"""');
    expect(text).toContain('"\'=HYPERLINK(1)\nPa"');
  });
});

describe("parseFamilies", () => {
  const limits = { maxSeats: 12, maxName: 60 };

  test("reads a family a line, its parts in any order after the name", () => {
    expect(
      parseFamilies(
        "Familia Popescu, 4, 0722 123 456\nIoana Marin; ioana@example.com\n\nAna și Radu\tnași\t3",
        limits,
      ),
    ).toEqual([
      { name: "Familia Popescu", seats: 4, phone: "0722 123 456" },
      { name: "Ioana Marin", seats: 1, email: "ioana@example.com" },
      { name: "Ana și Radu", seats: 3, note: "nași" },
    ]);
  });

  test("counts two for a couple or a family named without a number", () => {
    expect(
      parseFamilies("Ana & Mihai\nFamilia Dobre\nMihai\nAna and Tom", limits),
    ).toEqual([
      { name: "Ana & Mihai", seats: 2 },
      { name: "Familia Dobre", seats: 2 },
      { name: "Mihai", seats: 1 },
      { name: "Ana and Tom", seats: 2 },
    ]);
  });

  test("keeps within the limits", () => {
    const [family] = parseFamilies(`${"A".repeat(80)}, 40`, limits);
    expect(family?.name).toHaveLength(60);
    expect(family?.seats).toBe(12);
  });
});
