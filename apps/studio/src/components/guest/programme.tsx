"use client";

import {
  type Fields,
  formatDate,
  type Language,
  type Occasion,
} from "@jolene/design";
import { Button } from "@jolene/ui/button";
import { CalendarPlus, Navigation } from "lucide-react";
import { googleCalendarLink } from "@/lib/calendar";
import {
  appleMapsLink,
  googleMapsLink,
  placeQuery,
  wazeLink,
} from "@/lib/maps";
import { dayEvent, programmeStops } from "@/lib/programme";
import { useI18n } from "@/locales/client";

const pill =
  "inline-flex items-center rounded-full border border-border px-3 py-1.5 text-[13px] transition-colors hover:bg-accent";

/**
 * The day as guests plan it: each part's time and place, directions in the
 * maps they use, and the day in their calendar.
 */
export function Programme({
  occasion,
  fields,
  language,
  hosts,
  uid,
  calendarHref,
}: {
  occasion: Occasion;
  fields: Fields;
  language: Language;
  hosts: string;
  /** The calendar entry's id, the same each time it's added. */
  uid: string;
  /** The day's .ics file, which the studio serves. */
  calendarHref: string;
}) {
  const t = useI18n();
  const stops = programmeStops(occasion, fields, {
    civil: t("guest.civil"),
    ceremony: t(`guest.ceremony.${occasion}`),
    reception: t("guest.reception"),
  });
  const event = dayEvent({
    fields,
    stops,
    title: hosts
      ? t(`guest.eventTitle.${occasion}`, { hosts })
      : t("guest.eventTitle.untitled"),
    uid,
  });
  if (!event && stops.length === 0) return null;

  return (
    <section className="mx-auto w-full max-w-2xl px-6">
      <h2 className="text-center font-display text-4xl sm:text-5xl">
        {t("guest.programme")}
      </h2>
      {event ? (
        <p className="mt-3 text-center text-lg text-muted-foreground first-letter:uppercase">
          {formatDate(event.date, "long", language)}
        </p>
      ) : null}
      <ol className="mt-10 flex flex-col gap-8">
        {stops.map((stop) => {
          const query = placeQuery(stop.venue, stop.address);
          return (
            <li
              key={stop.key}
              className="grid gap-x-6 gap-y-2 border-t border-border/70 pt-6 sm:grid-cols-[5.5rem_minmax(0,1fr)]"
            >
              <p className="font-display text-3xl leading-none tabular-nums">
                {stop.time ?? ""}
              </p>
              <div className="flex flex-col gap-1.5">
                <h3 className="text-lg font-medium">{stop.title}</h3>
                {stop.venue ? <p>{stop.venue}</p> : null}
                {stop.address ? (
                  <p className="text-muted-foreground">{stop.address}</p>
                ) : null}
                {query ? (
                  <p className="mt-2 flex flex-wrap items-center gap-2">
                    <Navigation
                      className="size-4 text-muted-foreground"
                      aria-label={t("guest.directions")}
                    />
                    <a
                      className={pill}
                      href={wazeLink(query)}
                      target="_blank"
                      rel="noopener"
                    >
                      Waze
                    </a>
                    <a
                      className={pill}
                      href={googleMapsLink(query)}
                      target="_blank"
                      rel="noopener"
                    >
                      Google Maps
                    </a>
                    <a
                      className={pill}
                      href={appleMapsLink(query)}
                      target="_blank"
                      rel="noopener"
                    >
                      Apple Maps
                    </a>
                  </p>
                ) : null}
              </div>
            </li>
          );
        })}
      </ol>
      {event ? (
        <div className="mt-10 flex flex-wrap items-center justify-center gap-3 border-t border-border/70 pt-8">
          <span className="flex w-full items-center justify-center gap-2 text-sm text-muted-foreground sm:w-auto">
            <CalendarPlus className="size-4" aria-hidden />
            {t("guest.calendar")}
          </span>
          <Button asChild variant="outline" size="sm">
            <a href={googleCalendarLink(event)} target="_blank" rel="noopener">
              {t("guest.googleCalendar")}
            </a>
          </Button>
          <Button asChild variant="outline" size="sm">
            <a href={calendarHref}>{t("guest.icsCalendar")}</a>
          </Button>
        </div>
      ) : null}
    </section>
  );
}
