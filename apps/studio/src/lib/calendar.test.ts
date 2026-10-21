import { describe, expect, test } from "bun:test";
import { googleCalendarLink, hoursLater, icsFile } from "./calendar";
import { dayEvent, programmeStops } from "./programme";

const titles = {
  civil: "Cununia civilă",
  ceremony: "Cununia religioasă",
  reception: "Petrecerea",
};

const fields = {
  date: "2027-06-12",
  civilTime: "11:00",
  civilVenue: "Starea Civilă Iași",
  ceremonyTime: "15:00",
  ceremonyVenue: "Biserica Sfântul Nicolae",
  ceremonyAddress: "Strada Lăpușneanu 14, Iași",
  receptionTime: "19:00",
  receptionVenue: "Restaurant Grădina Verde",
};

describe("programmeStops", () => {
  test("lists the parts filled in, in the order of their times", () => {
    const stops = programmeStops(
      "wedding",
      { ...fields, civilTime: "16:30" },
      titles,
    );
    expect(stops.map((stop) => stop.key)).toEqual([
      "ceremony",
      "civil",
      "reception",
    ]);
  });

  test("keeps the order when a part has no time, and a christening has no civil part", () => {
    const stops = programmeStops(
      "christening",
      { ...fields, ceremonyTime: "" },
      titles,
    );
    expect(stops.map((stop) => stop.key)).toEqual(["ceremony", "reception"]);
  });
});

describe("dayEvent", () => {
  const stops = programmeStops("wedding", fields, titles);

  test("runs from the first part until five hours into the last", () => {
    const event = dayEvent({
      fields,
      stops,
      title: "Nunta: Ana și Mihai",
      uid: "ana-si-mihai@jolene.ro",
    });
    expect(event).toMatchObject({
      date: "2027-06-12",
      start: "11:00",
      end: "23:59",
      location: "Starea Civilă Iași",
    });
    expect(event?.description?.split("\n")).toEqual([
      "11:00 · Cununia civilă · Starea Civilă Iași",
      "15:00 · Cununia religioasă · Biserica Sfântul Nicolae, Strada Lăpușneanu 14, Iași",
      "19:00 · Petrecerea · Restaurant Grădina Verde",
    ]);
  });

  test("is nothing without a date", () => {
    expect(
      dayEvent({ fields: {}, stops: [], title: "Nunta", uid: "x" }),
    ).toBeNull();
  });
});

describe("hoursLater", () => {
  test("stops at the end of the day", () => {
    expect(hoursLater("15:30", 6)).toBe("21:30");
    expect(hoursLater("21:00", 6)).toBe("23:59");
  });
});

describe("icsFile", () => {
  const event = {
    title: "Nunta: Ana și Mihai",
    date: "2027-06-12",
    start: "15:00",
    end: "23:59",
    location: "Biserica Sfântul Nicolae, Iași",
    description: "15:00 · Cununia religioasă\n19:00 · Petrecerea",
    uid: "ana-si-mihai@jolene.ro",
  };
  const text = icsFile(event, new Date("2026-10-21T10:00:00Z"));
  const lines = text.split("\r\n");

  test("writes Romania's times with the zone they're in", () => {
    expect(lines).toContain("DTSTART;TZID=Europe/Bucharest:20270612T150000");
    expect(lines).toContain("DTEND;TZID=Europe/Bucharest:20270612T235900");
    expect(lines).toContain("BEGIN:VTIMEZONE");
    expect(lines).toContain("TZID:Europe/Bucharest");
    expect(lines).toContain("DTSTAMP:20261021T100000Z");
  });

  test("escapes text and folds long lines at 75 bytes", () => {
    expect(text).toContain("LOCATION:Biserica Sfântul Nicolae\\, Iași");
    expect(text).toContain(
      "DESCRIPTION:15:00 · Cununia religioasă\\n19:00 · Petrecerea",
    );
    for (const line of lines)
      expect(new TextEncoder().encode(line).length).toBeLessThanOrEqual(75);
    expect(text.endsWith("END:VCALENDAR\r\n")).toBe(true);
  });

  test("makes a day without a time an all-day entry", () => {
    const allDay = icsFile({ ...event, start: undefined, end: undefined });
    expect(allDay).toContain("DTSTART;VALUE=DATE:20270612");
    expect(allDay).toContain("DTEND;VALUE=DATE:20270613");
    expect(allDay).not.toContain("VTIMEZONE");
  });
});

describe("googleCalendarLink", () => {
  test("fills in Google Calendar's form in Romania's time", () => {
    const url = new URL(
      googleCalendarLink({
        title: "Nunta",
        date: "2027-06-12",
        start: "15:00",
        uid: "x",
      }),
    );
    expect(url.searchParams.get("dates")).toBe(
      "20270612T150000/20270612T210000",
    );
    expect(url.searchParams.get("ctz")).toBe("Europe/Bucharest");
  });
});
