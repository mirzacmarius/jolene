import { api } from "@jolene/backend/convex/_generated/api";
import { isLocale } from "@jolene/i18n";
import { fetchQuery } from "convex/nextjs";
import { env } from "@/env";
import { icsFile } from "@/lib/calendar";
import { fill } from "@/lib/invite-links";
import { dayEvent, programmeStops } from "@/lib/programme";
import { dictionaries } from "@/locales/dictionaries";

/**
 * The day of an invitation as an .ics file, which a phone's calendar adds
 * with a tap. It opens for whoever can open the invitation: a family's code
 * comes as ?code=.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const search = new URL(request.url).searchParams;
  const lang = search.get("lang");
  const data = await fetchQuery(
    api.guests.open,
    {
      slug,
      code: search.get("code") ?? undefined,
      language: lang && isLocale(lang) ? lang : undefined,
    },
    { url: env.NEXT_PUBLIC_CONVEX_URL },
  );
  if (data.kind !== "ready") return new Response(null, { status: 404 });
  const words = dictionaries[data.language].guest;
  const event = dayEvent({
    fields: data.fields,
    stops: programmeStops(data.occasion, data.fields, {
      civil: words.civil,
      ceremony: words.ceremony[data.occasion],
      reception: words.reception,
    }),
    title: data.hosts
      ? fill(words.eventTitle[data.occasion], { hosts: data.hosts })
      : words.eventTitle.untitled,
    uid: `${data.slug}@jolene.ro`,
  });
  if (!event) return new Response(null, { status: 404 });
  return new Response(icsFile(event), {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `inline; filename="${data.slug}.ics"`,
      "Cache-Control": "no-store",
    },
  });
}
