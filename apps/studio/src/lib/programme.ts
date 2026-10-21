import {
  type Fields,
  formatDate,
  type Language,
  type Occasion,
} from "@jolene/design";
import { type CalendarEvent, hoursLater } from "./calendar";
import { placeQuery } from "./maps";

/**
 * The day of an invitation as guests plan it, from the couple's details:
 * its parts in order, and the day as a calendar entry. The guest's page and
 * the .ics file it links to read the same.
 */

export interface Stop {
  key: "civil" | "ceremony" | "reception";
  title: string;
  time?: string;
  venue?: string;
  address?: string;
}

/** What each part is called, in the guest's language. */
export interface StopTitles {
  civil: string;
  ceremony: string;
  reception: string;
}

const value = (text: string | undefined) => text?.trim() || undefined;

/** The parts the couple filled in, in the order of their times. */
export function programmeStops(
  occasion: Occasion,
  fields: Fields,
  titles: StopTitles,
): Stop[] {
  const stops: Stop[] = [];
  if (
    occasion === "wedding" &&
    (value(fields.civilTime) || value(fields.civilVenue))
  )
    stops.push({
      key: "civil",
      title: titles.civil,
      time: value(fields.civilTime),
      venue: value(fields.civilVenue),
    });
  for (const key of ["ceremony", "reception"] as const) {
    const time = value(fields[`${key}Time`]);
    const venue = value(fields[`${key}Venue`]);
    const address = value(fields[`${key}Address`]);
    if (time || venue || address)
      stops.push({ key, title: titles[key], time, venue, address });
  }
  // Times written HH:MM sort as text; without them all, the order stays.
  return stops.every((stop) => stop.time)
    ? stops.sort((a, b) => (a.time as string).localeCompare(b.time as string))
    : stops;
}

/**
 * The day as one calendar entry, from its first part with a time until
 * five hours into its last, with every part in its notes. Null without a
 * date.
 */
export function dayEvent({
  fields,
  stops,
  title,
  uid,
}: {
  fields: Fields;
  stops: Stop[];
  title: string;
  uid: string;
}): CalendarEvent | null {
  const date = value(fields.date);
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const timed = stops.filter((stop) => stop.time);
  const first = timed[0] ?? stops[0];
  const last = timed.at(-1);
  const lines = stops.map((stop) =>
    [stop.time, stop.title, placeQuery(stop.venue, stop.address)]
      .filter(Boolean)
      .join(" · "),
  );
  return {
    title,
    date,
    start: first?.time,
    // The party goes on after its start; a single stop takes the default.
    end: last?.time && last !== first ? hoursLater(last.time, 5) : undefined,
    location: first ? placeQuery(first.venue, first.address) : undefined,
    description: lines.join("\n") || undefined,
    uid,
  };
}

/** "15 mai 2027": a date as a sentence names it, without the weekday. */
export function plainDate(date: string, language: Language) {
  return formatDate(date, "long", language).replace(/^[^,]+, /, "");
}
