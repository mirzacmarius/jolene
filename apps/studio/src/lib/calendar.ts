/**
 * The day of an invitation in guests' calendars: a Google Calendar link,
 * and an .ics file every phone's calendar opens. Times are Romania's, where
 * couples hold their weddings, written with the time zone so a guest abroad
 * sees them in their own.
 */

export interface CalendarEvent {
  title: string;
  /** YYYY-MM-DD. */
  date: string;
  /** HH:MM, Romania's time; the whole day when absent. */
  start?: string;
  /** HH:MM; six hours after the start when absent. */
  end?: string;
  location?: string;
  description?: string;
  /** A stable id, so adding it again updates the same entry. */
  uid: string;
}

const ZONE = "Europe/Bucharest";

/**
 * Romania's time zone as an .ics file describes it, for the calendars that
 * don't know it by name: two hours ahead of UTC, three in summer, changing
 * on the last Sundays of March and October.
 */
const ZONE_RULES = [
  "BEGIN:VTIMEZONE",
  `TZID:${ZONE}`,
  "BEGIN:DAYLIGHT",
  "TZOFFSETFROM:+0200",
  "TZOFFSETTO:+0300",
  "TZNAME:EEST",
  "DTSTART:19700329T030000",
  "RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU",
  "END:DAYLIGHT",
  "BEGIN:STANDARD",
  "TZOFFSETFROM:+0300",
  "TZOFFSETTO:+0200",
  "TZNAME:EET",
  "DTSTART:19701025T040000",
  "RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU",
  "END:STANDARD",
  "END:VTIMEZONE",
];

/** "2027-06-12" and "15:00" → "20270612T150000". */
function stamp(date: string, time: string) {
  return `${date.replaceAll("-", "")}T${time.replace(":", "")}00`;
}

/** The day after a YYYY-MM-DD date, for an all-day entry's end. */
function nextDay(date: string) {
  const day = new Date(`${date}T00:00:00Z`);
  day.setUTCDate(day.getUTCDate() + 1);
  return day.toISOString().slice(0, 10);
}

/** HH:MM `hours` later, stopping at 23:59 so it stays on the same day. */
export function hoursLater(time: string, hours: number) {
  const [h, m] = time.split(":").map(Number) as [number, number];
  const total = Math.min(h * 60 + m + hours * 60, 23 * 60 + 59);
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

function span(event: CalendarEvent) {
  if (!event.start)
    return {
      allDay: true,
      start: event.date.replaceAll("-", ""),
      end: nextDay(event.date).replaceAll("-", ""),
    };
  return {
    allDay: false,
    start: stamp(event.date, event.start),
    end: stamp(event.date, event.end ?? hoursLater(event.start, 6)),
  };
}

/** A link that opens Google Calendar with the entry filled in. */
export function googleCalendarLink(event: CalendarEvent) {
  const { allDay, start, end } = span(event);
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: event.title,
    dates: `${start}/${end}`,
    ...(allDay ? {} : { ctz: ZONE }),
    ...(event.location ? { location: event.location } : {}),
    ...(event.description ? { details: event.description } : {}),
  });
  return `https://calendar.google.com/calendar/render?${params}`;
}

/** Escapes text for an .ics property. */
function icsText(text: string) {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

/** Folds an .ics line at 75 octets, as the format asks. */
function fold(line: string) {
  const bytes = new TextEncoder().encode(line);
  if (bytes.length <= 75) return line;
  const parts: string[] = [];
  let current = "";
  let size = 0;
  for (const char of line) {
    const length = new TextEncoder().encode(char).length;
    if (size + length > (parts.length === 0 ? 75 : 74)) {
      parts.push(current);
      current = "";
      size = 0;
    }
    current += char;
    size += length;
  }
  parts.push(current);
  return parts.join("\r\n ");
}

/** The entry as an .ics file's text. */
export function icsFile(event: CalendarEvent, now = new Date()) {
  const { allDay, start, end } = span(event);
  const created = `${now.toISOString().replace(/[-:]/g, "").slice(0, 15)}Z`;
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Jolene//Invitatie digitala//RO",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    ...(allDay ? [] : ZONE_RULES),
    "BEGIN:VEVENT",
    `UID:${event.uid}`,
    `DTSTAMP:${created}`,
    allDay ? `DTSTART;VALUE=DATE:${start}` : `DTSTART;TZID=${ZONE}:${start}`,
    allDay ? `DTEND;VALUE=DATE:${end}` : `DTEND;TZID=${ZONE}:${end}`,
    `SUMMARY:${icsText(event.title)}`,
    ...(event.location ? [`LOCATION:${icsText(event.location)}`] : []),
    ...(event.description ? [`DESCRIPTION:${icsText(event.description)}`] : []),
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  return `${lines.map(fold).join("\r\n")}\r\n`;
}
