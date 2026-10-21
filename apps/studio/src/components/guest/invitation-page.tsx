"use client";

import { api } from "@jolene/backend/convex/_generated/api";
import {
  type DesignDocument,
  type Fields,
  type Language,
  monogram,
} from "@jolene/design";
import { lifelikeFrame, tabletopColor } from "@jolene/design/react";
import { Logo } from "@jolene/ui/logo";
import { cn } from "@jolene/ui/utils";
import { type Preloaded, useMutation, usePreloadedQuery } from "convex/react";
import { ChevronDown } from "lucide-react";
import {
  type CSSProperties,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import {
  type AssetLink,
  DesignPreview,
} from "@/components/design/design-preview";
import { densityStep, Tablecloth } from "@/components/design/preview-stage";
import { useI18n } from "@/locales/client";
import { Envelope } from "./envelope";
import { GuestReply } from "./guest-reply";
import { Programme } from "./programme";
import { recall, remember } from "./visit";

/**
 * The couple's design as the printed card would look lying on a table,
 * drawn as fine as the screen shows it.
 */
function TableCard({
  document,
  fields,
  assets,
  title,
  scrollLabel,
}: {
  document: DesignDocument;
  fields: Fields;
  assets: readonly AssetLink[];
  title: string;
  /** What the arrow down to the programme says to screen readers. */
  scrollLabel: string;
}) {
  const card = useRef<HTMLDivElement>(null);
  const frame = lifelikeFrame(document, { kind: "assembly" });
  const [width, setWidth] = useState(0);
  const [density, setDensity] = useState(1);
  useLayoutEffect(() => {
    const element = card.current;
    if (!element) return;
    const measure = () => {
      setWidth(element.getBoundingClientRect().width);
      setDensity(window.devicePixelRatio || 1);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  const perMm = width / frame.width;
  const pixelsPerMm = width > 0 ? densityStep(perMm * density) : undefined;
  return (
    <section className="relative overflow-hidden">
      <Tablecloth
        color={tabletopColor(document.theme.palette)}
        pixelsPerMm={pixelsPerMm}
        perMm={perMm || 1}
        origin={null}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(120% 90% at 25% 15%, rgb(255 250 240 / 0.16), rgb(255 250 240 / 0) 55%), radial-gradient(140% 120% at 50% 45%, rgb(40 30 20 / 0) 55%, rgb(40 30 20 / 0.14))",
        }}
      />
      <div className="relative mx-auto flex min-h-[88svh] max-w-3xl flex-col items-center justify-center px-4 pt-10 pb-6">
        <div
          ref={card}
          className="w-full max-w-[min(100%,calc(78svh*var(--ratio)))]"
          style={
            {
              aspectRatio: `${frame.width} / ${frame.height}`,
              "--ratio": frame.width / frame.height,
            } as CSSProperties
          }
        >
          <DesignPreview
            document={document}
            fields={fields}
            assets={assets}
            lifelike
            pixelsPerMm={pixelsPerMm}
            title={title}
            className="size-full"
          />
        </div>
        <a
          href="#programul-zilei"
          className="mt-6 inline-flex size-10 items-center justify-center rounded-full bg-white/70 text-[#2b2622] shadow-sm backdrop-blur transition-colors hover:bg-white"
        >
          <ChevronDown aria-hidden />
          <span className="sr-only">{scrollLabel}</span>
        </a>
      </div>
    </section>
  );
}

/** What a link shows when the invitation can't open, in both languages. */
export function Unavailable({
  kind,
  texts,
}: {
  kind: "not-found" | "unpublished" | "locked" | "personal";
  texts: Record<Language, Record<typeof kind, string>>;
}) {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-8 px-6 text-center">
      <Logo className="h-10 w-auto opacity-80" />
      <div className="flex max-w-md flex-col gap-3">
        <p className="font-display text-3xl">{texts.ro[kind]}</p>
        <p lang="en" className="text-muted-foreground">
          {texts.en[kind]}
        </p>
      </div>
    </main>
  );
}

/**
 * A digital invitation as its guests open it: the envelope with their name,
 * the couple's card on a table, the day's programme with directions and the
 * calendar, the couple's note, and the reply.
 */
export function InvitationPage({
  preloaded,
  code,
  calendarHref,
  unavailable,
}: {
  preloaded: Preloaded<typeof api.guests.open>;
  code?: string;
  calendarHref: string;
  unavailable: Record<
    Language,
    Record<"not-found" | "unpublished" | "locked" | "personal", string>
  >;
}) {
  const t = useI18n();
  const data = usePreloadedQuery(preloaded);
  const seen = useMutation(api.guests.seen);
  const [opened, setOpened] = useState(false);
  const slug = data.kind === "ready" ? data.slug : null;
  const language = data.kind === "ready" ? data.language : null;

  // Before the first paint, so an envelope opened in this tab doesn't flash.
  useLayoutEffect(() => {
    if (slug && recall("opened", slug, code)) setOpened(true);
  }, [slug, code]);

  useEffect(() => {
    if (slug && code) void seen({ slug, code }).catch(() => {});
  }, [slug, code, seen]);

  useEffect(() => {
    if (language) document.documentElement.lang = language;
  }, [language]);

  const open = useCallback(() => {
    setOpened(true);
    window.scrollTo({ top: 0 });
    if (slug) remember("opened", slug, code);
  }, [slug, code]);

  if (data.kind !== "ready")
    return <Unavailable kind={data.kind} texts={unavailable} />;

  const design = data.document as DesignDocument;
  const palette = design.theme.palette;
  return (
    <>
      {opened ? null : (
        <Envelope
          name={data.household?.name ?? null}
          seal={monogram(data.fields, data.occasion)}
          sealColor={palette.accent}
          background={tabletopColor(palette)}
          onOpen={open}
        />
      )}
      <main
        className={cn(
          "min-h-dvh bg-background",
          !opened && "h-dvh overflow-hidden",
        )}
      >
        <TableCard
          document={design}
          fields={data.fields}
          assets={data.assets}
          title={data.hosts}
          scrollLabel={t("guest.programme")}
        />
        <div className="flex flex-col gap-20 py-16 sm:gap-24 sm:py-24">
          <div id="programul-zilei" className="scroll-mt-8">
            <Programme
              occasion={data.occasion}
              fields={data.fields}
              language={data.language}
              hosts={data.hosts}
              uid={`${data.slug}@jolene.ro`}
              calendarHref={calendarHref}
            />
          </div>
          {data.note ? (
            <section className="mx-auto w-full max-w-2xl px-6 text-center">
              <p className="font-display text-2xl leading-snug whitespace-pre-line">
                {data.note}
              </p>
            </section>
          ) : null}
          <GuestReply
            slug={data.slug}
            language={data.language}
            fields={data.fields}
            hosts={data.hosts}
            questions={data.questions}
            household={data.household}
          />
        </div>
        <footer className="flex flex-col items-center gap-4 border-t border-border/70 px-6 py-10 text-sm text-muted-foreground">
          <nav aria-label={t("guest.language")} className="flex gap-1">
            {(["ro", "en"] as const).map((choice) => (
              <a
                key={choice}
                href={`?lang=${choice}`}
                lang={choice}
                aria-current={choice === data.language ? "true" : undefined}
                className={cn(
                  "rounded-full px-3 py-1 transition-colors hover:text-foreground",
                  choice === data.language && "bg-secondary text-foreground",
                )}
              >
                {choice === "ro" ? "Română" : "English"}
              </a>
            ))}
          </nav>
          <a
            href="https://jolene.ro"
            className="flex items-center gap-2 transition-colors hover:text-foreground"
          >
            <Logo alt="" className="h-5 w-auto" />
            {t("guest.madeWith")}
          </a>
        </footer>
      </main>
    </>
  );
}
