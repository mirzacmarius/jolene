import { api } from "@jolene/backend/convex/_generated/api";
import { productKindLabels } from "@jolene/design";
import { defaultLocale, isLocale } from "@jolene/i18n";
import { fetchQuery } from "convex/nextjs";
import type { Metadata } from "next";
import { io } from "next/cache";
import { Suspense } from "react";
import {
  DesignView,
  DesignViewSkeleton,
} from "@/components/design/design-view";
import { env } from "@/env";
import { dictionaries } from "@/locales/dictionaries";

/**
 * Where a design's viewing link leads (docs/adr/0023): the design for
 * whoever has the link, read from Convex in the browser and kept live. The
 * link's preview where it's shared, on WhatsApp first, names the item and
 * the couple and shows the studio's picture of it.
 */

interface Route {
  params: Promise<{ locale: string; code: string }>;
}

export async function generateMetadata({ params }: Route): Promise<Metadata> {
  await io();
  const { locale: requested, code } = await params;
  const locale = isLocale(requested) ? requested : defaultLocale;
  const words = dictionaries[locale].view;
  const robots = { index: false, follow: false };
  const data = await fetchQuery(
    api.designs.view,
    { code },
    { url: env.NEXT_PUBLIC_CONVEX_URL },
  ).catch(() => null);
  if (!data) return { title: words.notFound, robots };
  const item = productKindLabels[data.kind][locale];
  const title = `${item} · ${data.suite[locale]}`;
  const hosts = data.hosts[locale];
  const description = hosts
    ? words.from.replace("{hosts}", hosts)
    : words.fromUnnamed;
  const images = data.image ? [{ url: data.image }] : undefined;
  return {
    title,
    description,
    robots,
    openGraph: { title, description, images, type: "website" },
    twitter: { card: "summary_large_image", title, description, images },
  };
}

async function View({ params }: Route) {
  return <DesignView code={(await params).code} />;
}

/** The code comes from the URL, so the view is read inside Suspense. */
export default function Page({ params }: Route) {
  return (
    <Suspense fallback={<DesignViewSkeleton />}>
      <View params={params} />
    </Suspense>
  );
}
