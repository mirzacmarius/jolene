import { api } from "@jolene/backend/convex/_generated/api";
import { formatDate, type Language } from "@jolene/design";
import { isLocale } from "@jolene/i18n";
import { fetchQuery, preloadedQueryResult, preloadQuery } from "convex/nextjs";
import type { Metadata } from "next";
import { io } from "next/cache";
import { GuestProviders } from "@/components/guest/guest-providers";
import {
  InvitationPage,
  Unavailable,
} from "@/components/guest/invitation-page";
import { env } from "@/env";
import { fill } from "@/lib/invite-links";
import { dictionaries } from "@/locales/dictionaries";

/**
 * What both of a guest's addresses show: the open link (/<slug>) and a
 * family's own (/<slug>/<code>). The invitation comes from Convex as the
 * page renders, and stays live in the browser, so a reply shows at once.
 */

const options = { url: env.NEXT_PUBLIC_CONVEX_URL };

export interface GuestRoute {
  params: Promise<{ slug: string; code?: string }>;
  searchParams: Promise<{ lang?: string | string[] }>;
}

/** The language the guest picked on the page (?lang=), if any. */
async function picked(searchParams: GuestRoute["searchParams"]) {
  const { lang } = await searchParams;
  return typeof lang === "string" && isLocale(lang) ? lang : undefined;
}

/** What a link shows when it can't open the invitation, in both languages. */
const unavailable = Object.fromEntries(
  (["ro", "en"] as const).map((language) => {
    const words = dictionaries[language].guest;
    return [
      language,
      {
        "not-found": words.notFound,
        unpublished: words.unpublished,
        locked: words.locked,
        personal: words.personal,
      },
    ];
  }),
) as Record<
  Language,
  Record<"not-found" | "unpublished" | "locked" | "personal", string>
>;

/**
 * The link's preview where it's shared, on WhatsApp first: who it's from,
 * for whom and when, with the studio's picture of the card.
 */
export async function guestMetadata({
  params,
  searchParams,
}: GuestRoute): Promise<Metadata> {
  await io();
  const { slug, code } = await params;
  const data = await fetchQuery(
    api.guests.open,
    { slug, code, language: await picked(searchParams) },
    options,
  );
  const robots = { index: false, follow: false };
  if (data.kind !== "ready") return { title: "Jolene", robots };
  const words = dictionaries[data.language].guest;
  const title = data.hosts
    ? fill(words.eventTitle[data.occasion], { hosts: data.hosts })
    : words.eventTitle.untitled;
  const date = data.fields.date
    ? formatDate(data.fields.date, "long", data.language)
    : null;
  const description = [
    data.household ? fill(words.forName, { name: data.household.name }) : null,
    date,
  ]
    .filter(Boolean)
    .join(" · ");
  const images = data.image ? [{ url: data.image }] : undefined;
  return {
    title,
    description,
    robots,
    openGraph: { title, description, images, type: "website" },
    twitter: { card: "summary_large_image", title, description, images },
  };
}

export async function GuestPage({ params, searchParams }: GuestRoute) {
  // Read from Convex for each visit, never into a prerendered shell.
  await io();
  const { slug, code } = await params;
  const preloaded = await preloadQuery(
    api.guests.open,
    { slug, code, language: await picked(searchParams) },
    options,
  );
  const data = preloadedQueryResult(preloaded);
  if (data.kind !== "ready")
    return <Unavailable kind={data.kind} texts={unavailable} />;
  return (
    <GuestProviders
      locale={data.language}
      dictionary={dictionaries[data.language]}
    >
      <InvitationPage
        preloaded={preloaded}
        code={code}
        // Relative, so it works on invitatie.jolene.ro and under /invitatie.
        calendarHref={
          code
            ? `calendar.ics?code=${code}&lang=${data.language}`
            : `${slug}/calendar.ics?lang=${data.language}`
        }
        unavailable={unavailable}
      />
    </GuestProviders>
  );
}

/** While the invitation loads: the table it lies on. */
export function GuestLoading() {
  return <div className="min-h-dvh animate-pulse bg-[#efe9df]" />;
}
