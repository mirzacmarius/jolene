"use client";

import { api } from "@jolene/backend/convex/_generated/api";
import {
  MAX_LINE_LENGTH,
  occasionTones,
  type Tone,
} from "@jolene/backend/convex/simple/tones";
import {
  type DesignDocument,
  fieldsFor,
  type Language,
  type Occasion,
  type ProductKind,
  previewFields,
  productKindLabels,
} from "@jolene/design";
import { localeNames, locales } from "@jolene/i18n";
import { Button } from "@jolene/ui/button";
import { Label } from "@jolene/ui/label";
import { Textarea } from "@jolene/ui/textarea";
import { toast } from "@jolene/ui/toaster";
import { cn } from "@jolene/ui/utils";
import { useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { Check, LoaderCircle, Sparkles, X } from "lucide-react";
import {
  type ReactNode,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import { useCurrentLocale, useI18n } from "@/locales/client";
import { startOfDay } from "../ai/ai-designer";
import { type AssetLink, DesignPreview } from "../design/design-preview";
import { Field } from "../workspace/fields-panel";
import { itemRequest } from "./request";

type DesignData = NonNullable<FunctionReturnType<typeof api.designs.get>>;
type Translate = ReturnType<typeof useI18n>;
type Composed = FunctionReturnType<typeof api.simple.compose>;

type StepId =
  | "couple"
  | "child"
  | "family"
  | "ceremony"
  | "party"
  | "civil"
  | "replies"
  | "tone"
  | "language"
  | "items";

interface Step {
  id: StepId;
  /** The details the step asks for. */
  fields: string[];
}

/**
 * The questions, one or two to a step: who, when and where, the replies,
 * then how the wording should sound and in which language (when the AI
 * designer can write it), and which items to make.
 */
function stepsFor(occasion: Occasion, writes: boolean): Step[] {
  const people: Step[] =
    occasion === "wedding"
      ? [
          { id: "couple", fields: ["partner1", "partner2"] },
          {
            id: "family",
            fields: ["partner1Parents", "partner2Parents", "godparents"],
          },
        ]
      : [
          { id: "child", fields: ["child"] },
          { id: "family", fields: ["parents", "godparents"] },
        ];
  return [
    ...people,
    { id: "ceremony", fields: ["date", "ceremonyTime", "ceremonyVenue"] },
    { id: "party", fields: ["receptionTime", "receptionVenue"] },
    ...(occasion === "wedding"
      ? [{ id: "civil" as const, fields: ["civilTime", "civilVenue"] }]
      : []),
    { id: "replies", fields: ["rsvpBy", "rsvpContact"] },
    ...(writes
      ? [
          { id: "tone" as const, fields: [] },
          { id: "language" as const, fields: [] },
        ]
      : []),
    { id: "items", fields: [] },
  ];
}

function stepWords(t: Translate, id: StepId, occasion: Occasion) {
  switch (id) {
    case "couple":
      return { title: t("simple.couple.title"), hint: t("simple.couple.hint") };
    case "child":
      return { title: t("simple.child.title"), hint: t("simple.child.hint") };
    case "family":
      return { title: t("simple.family.title"), hint: t("simple.family.hint") };
    case "ceremony":
      return {
        title:
          occasion === "christening"
            ? t("simple.ceremony.christening")
            : t("simple.ceremony.title"),
        hint: t("simple.ceremony.hint"),
      };
    case "party":
      return { title: t("simple.party.title"), hint: t("simple.party.hint") };
    case "civil":
      return { title: t("simple.civil.title"), hint: t("simple.civil.hint") };
    case "replies":
      return {
        title: t("simple.replies.title"),
        hint: t("simple.replies.hint"),
      };
    case "tone":
      return { title: t("simple.tone.title"), hint: t("simple.tone.hint") };
    case "language":
      return {
        title: t("simple.language.title"),
        hint: t("simple.language.hint"),
      };
    case "items":
      return { title: t("simple.items.title"), hint: t("simple.items.hint") };
  }
}

function toneName(t: Translate, tone: Tone) {
  switch (tone) {
    case "classic":
      return t("simple.tone.classic");
    case "romantic":
      return t("simple.tone.romantic");
    case "modern":
      return t("simple.tone.modern");
    case "tender":
      return t("simple.tone.tender");
    case "playful":
      return t("simple.tone.playful");
  }
}

/** A line in the tone, with the couple's names (or the examples). */
function toneSample(
  t: Translate,
  occasion: Occasion,
  tone: Tone,
  name: (key: string) => string,
) {
  const couple = { partner1: name("partner1"), partner2: name("partner2") };
  const child = { child: name("child") };
  if (occasion === "wedding")
    switch (tone) {
      case "romantic":
        return t("simple.samples.weddingRomantic", couple);
      case "modern":
        return t("simple.samples.weddingModern", couple);
      default:
        return t("simple.samples.weddingClassic", couple);
    }
  switch (tone) {
    case "tender":
      return t("simple.samples.christeningTender", child);
    case "playful":
      return t("simple.samples.christeningPlayful", child);
    default:
      return t("simple.samples.christeningClassic", child);
  }
}

/** The guided start offered once per event; set when it is answered or declined. */
const DECLINED = "jolene.studio.guidedStart.";

function wasDeclined(eventId: string) {
  try {
    return window.localStorage.getItem(DECLINED + eventId) === "1";
  } catch {
    return false;
  }
}

function decline(eventId: string) {
  try {
    window.localStorage.setItem(DECLINED + eventId, "1");
  } catch {
    // Without storage the offer comes back on the next visit.
  }
}

type Phase = "offer" | "steps" | "started" | "closed";

/**
 * Simple mode's guided start, in the Details tab: a few friendly questions,
 * each one skippable, whose answers go to the event as they are given, then
 * the items to make. The AI designer then writes the wording of each item
 * and lays it out, the invitation first; without it, the items start in
 * Jolene's wording. Offered when the event has no details yet, and there to
 * open again above the details.
 */
export function GuidedStart({
  data,
  values,
  onChange,
  children,
}: {
  data: DesignData;
  /** The couple's details as typed here, saved as they change. */
  values: Record<string, string>;
  onChange: (key: string, value: string) => void;
  /** The details form, shown whenever the questions aren't. */
  children: ReactNode;
}) {
  const t = useI18n();
  const locale = useCurrentLocale();
  const document = data.design.document as DesignDocument;
  const { event } = data;
  const occasion = event.occasion;
  const headingId = useId();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const againRef = useRef<HTMLButtonElement>(null);

  const [phase, setPhase] = useState<Phase>(() =>
    Object.keys(event.fields).length === 0 && !wasDeclined(event._id)
      ? "offer"
      : "closed",
  );
  const [index, setIndex] = useState(0);
  const [tone, setTone] = useState<Tone | undefined>(event.wording?.tone);
  const [line, setLine] = useState(event.wording?.line ?? "");
  const [language, setLanguage] = useState<Language>(
    event.wording?.language ?? locale,
  );
  const [chosen, setChosen] = useState<ReadonlySet<ProductKind>>(
    () => new Set([document.kind]),
  );
  const [civil, setCivil] = useState(() =>
    Boolean(values.civilTime || values.civilVenue),
  );
  const [busy, setBusy] = useState(false);
  const [composed, setComposed] = useState<Composed>();
  const [since] = useState(startOfDay);

  const availability = useQuery(api.ai.availability, { since });
  const writes = availability?.configured === true;
  const asking = phase === "steps";
  const suite = useQuery(
    api.catalog.suite,
    asking ? { slug: data.template.suite.slug } : "skip",
  );
  const collection = useQuery(
    api.simple.collection,
    asking ? { designId: data.design._id } : "skip",
  );
  const compose = useMutation(api.simple.compose);

  const steps = useMemo(() => stepsFor(occasion, writes), [occasion, writes]);
  const step = steps[Math.min(index, steps.length - 1)] ?? steps[0];
  const last = index >= steps.length - 1;

  // The heading of each step takes the focus, so it is read out, and the
  // step comes into view from its top; closing hands the focus to the button
  // that opens the questions again.
  const moved = useRef(false);
  useEffect(() => {
    if (!moved.current) return;
    if (phase === "closed") {
      againRef.current?.focus();
      return;
    }
    const heading = headingRef.current;
    heading?.focus({ preventScroll: true });
    heading?.closest("section")?.scrollIntoView({ block: "start" });
  }, [phase, index]);
  const go = (next: Phase, at = index) => {
    moved.current = true;
    setPhase(next);
    setIndex(at);
  };

  // Each item the collection offers, in its order, drawn as the couple's own
  // design of it when they have one.
  const items = useMemo(() => {
    const own = new Map<ProductKind, DesignDocument>();
    for (const design of collection?.designs ?? [])
      if (!own.has(design.kind) || design._id === data.design._id)
        own.set(design.kind, design.document as DesignDocument);
    own.set(document.kind, document);
    const shown = new Map<ProductKind, DesignDocument>();
    for (const template of suite?.templates ?? [])
      if (!shown.has(template.kind))
        shown.set(
          template.kind,
          own.get(template.kind) ?? (template.document as DesignDocument),
        );
    for (const [kind, design] of own)
      if (!shown.has(kind)) shown.set(kind, design);
    return [...shown].map(([kind, design]) => ({ kind, design }));
  }, [suite, collection, data.design._id, document]);
  const assets = useMemo<AssetLink[]>(
    () => [
      ...data.assets,
      ...(suite?.assets ?? []),
      ...(collection?.assets ?? []),
    ],
    [data.assets, suite, collection],
  );

  const left = availability
    ? Math.max(0, availability.limit - availability.used)
    : 0;
  const ordered = items
    .map((item) => item.kind)
    .filter((kind) => chosen.has(kind));

  const create = async () => {
    if (busy || ordered.length === 0) return;
    setBusy(true);
    const first = ordered.includes("invitation") ? "invitation" : ordered[0];
    try {
      const result = await compose({
        designId: data.design._id,
        items: ordered.map((kind) => ({
          kind,
          request: itemRequest(t, {
            kind,
            first: kind === first,
            occasion,
            tone,
            line,
            language,
          }),
        })),
        ...(writes && tone ? { tone } : {}),
        ...(writes && line.trim() ? { line: line.trim() } : {}),
        language: writes ? language : document.language,
        locale,
      });
      decline(event._id);
      setComposed(result);
      go("started", 0);
    } catch {
      toast.error(t("simple.failed"));
    } finally {
      setBusy(false);
    }
  };

  if (phase === "closed")
    return (
      <div className="space-y-6">
        <Button
          ref={againRef}
          variant="outline"
          size="sm"
          onClick={() => go("steps", 0)}
        >
          <Sparkles aria-hidden className="text-gold" />
          {t("simple.again")}
        </Button>
        {children}
      </div>
    );

  if (phase === "offer")
    return (
      <div className="space-y-6">
        <section
          aria-labelledby={headingId}
          className="space-y-3 rounded-2xl border border-border/80 bg-background/60 p-4"
        >
          <Sparkles className="size-5 text-gold" aria-hidden />
          <h2 id={headingId} className="font-display text-2xl leading-tight">
            {t("simple.offer.title")}
          </h2>
          <p className="text-sm leading-relaxed text-muted-foreground">
            {availability?.configured === false
              ? t("simple.offer.leadSoon")
              : t("simple.offer.lead")}
          </p>
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <Button size="sm" onClick={() => go("steps", 0)}>
              {t("simple.offer.start")}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                decline(event._id);
                go("closed");
              }}
            >
              {t("simple.offer.later")}
            </Button>
          </div>
        </section>
        {children}
      </div>
    );

  if (phase === "started" && composed) {
    const written = composed.items.filter((item) => item.written).length;
    const [title, lead] = !writes
      ? [t("simple.started.soonTitle"), t("simple.started.soonLead")]
      : written === 0
        ? [t("simple.started.plainTitle"), t("simple.items.none")]
        : [t("simple.started.title"), t("simple.started.lead")];
    return (
      <div className="space-y-6">
        <section
          aria-labelledby={headingId}
          className="scroll-mt-5 space-y-3 rounded-2xl border border-border/80 bg-background/60 p-4"
        >
          <Sparkles className="size-5 text-gold" aria-hidden />
          <h2
            id={headingId}
            ref={headingRef}
            tabIndex={-1}
            className="font-display text-2xl leading-tight outline-none"
          >
            {title}
          </h2>
          <p className="text-sm leading-relaxed text-muted-foreground">
            {lead}
          </p>
          {writes && written > 0 && written < composed.items.length ? (
            <p className="text-sm leading-relaxed text-muted-foreground">
              {t("simple.started.some", { count: written })}
            </p>
          ) : null}
          <Button size="sm" onClick={() => go("closed")}>
            {t("simple.started.done")}
          </Button>
        </section>
        {children}
      </div>
    );
  }

  if (!step) return children;
  const words = stepWords(t, step.id, occasion);
  const definitions = fieldsFor(occasion);
  const field = (key: string) => {
    const definition = definitions[key];
    return definition ? (
      <Field
        key={key}
        id={key}
        definition={definition}
        language={document.language}
        value={values[key] ?? ""}
        onChange={(value) => onChange(key, value)}
      />
    ) : null;
  };
  const answered =
    step.id === "tone"
      ? Boolean(tone || line.trim())
      : step.id === "civil"
        ? civil
        : step.id === "language" ||
          step.fields.some((key) => (values[key] ?? "").trim() !== "");
  const name = (key: string) =>
    values[key]?.trim() || (definitions[key]?.examples[locale] ?? "");

  let body: ReactNode;
  switch (step.id) {
    case "civil":
      body = (
        <div className="space-y-4">
          <label className="flex items-center gap-2.5 text-sm font-medium">
            <input
              type="checkbox"
              checked={civil}
              onChange={(event) => {
                setCivil(event.target.checked);
                if (!event.target.checked)
                  for (const key of step.fields)
                    if (values[key]) onChange(key, "");
              }}
              className="size-4 accent-[var(--color-primary)]"
            />
            {t("simple.civil.show")}
          </label>
          {civil ? (
            <div className="space-y-4">{step.fields.map(field)}</div>
          ) : null}
        </div>
      );
      break;
    case "tone":
      body = (
        <div className="space-y-5">
          <div className="grid gap-2">
            {occasionTones[occasion].map((option) => {
              const active = tone === option;
              return (
                <button
                  key={option}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setTone(active ? undefined : option)}
                  className={cn(
                    "rounded-xl border bg-card px-3.5 py-3 text-left outline-none transition focus-visible:ring-[3px] focus-visible:ring-ring/50",
                    active
                      ? "border-foreground/40 shadow-sm"
                      : "border-border hover:border-foreground/20",
                  )}
                >
                  <span className="flex items-center justify-between gap-2 text-sm font-medium">
                    {toneName(t, option)}
                    {active ? <Check className="size-4" aria-hidden /> : null}
                  </span>
                  <span className="mt-1 block font-display text-[17px] leading-snug text-muted-foreground italic">
                    {toneSample(t, occasion, option, name)}
                  </span>
                </button>
              );
            })}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`${headingId}-line`}>{t("simple.tone.line")}</Label>
            <Textarea
              id={`${headingId}-line`}
              value={line}
              rows={2}
              maxLength={MAX_LINE_LENGTH}
              aria-describedby={`${headingId}-line-hint`}
              onChange={(event) => setLine(event.target.value)}
            />
            <p
              id={`${headingId}-line-hint`}
              className="text-xs leading-snug text-muted-foreground"
            >
              {t("simple.tone.lineHint")}
            </p>
          </div>
        </div>
      );
      break;
    case "language":
      body = (
        <div className="grid grid-cols-2 gap-2">
          {locales.map((option) => {
            const active = language === option;
            return (
              <button
                key={option}
                type="button"
                lang={option}
                aria-pressed={active}
                onClick={() => setLanguage(option)}
                className={cn(
                  "flex items-center justify-between gap-2 rounded-xl border bg-card px-3.5 py-3 text-left text-sm font-medium outline-none transition focus-visible:ring-[3px] focus-visible:ring-ring/50",
                  active
                    ? "border-foreground/40 shadow-sm"
                    : "border-border hover:border-foreground/20",
                )}
              >
                {localeNames[option]}
                {active ? <Check className="size-4" aria-hidden /> : null}
              </button>
            );
          })}
        </div>
      );
      break;
    case "items":
      body = (
        <div className="space-y-4">
          {suite === undefined || collection === undefined ? (
            <LoaderCircle
              className="size-5 animate-spin text-muted-foreground"
              aria-hidden
            />
          ) : (
            <ul className="grid grid-cols-2 gap-2.5">
              {items.map(({ kind, design }) => {
                const here = kind === document.kind;
                const active = here || chosen.has(kind);
                return (
                  <li key={kind}>
                    <button
                      type="button"
                      aria-pressed={active}
                      aria-disabled={here}
                      onClick={() => {
                        if (here) return;
                        setChosen((now) => {
                          const next = new Set(now);
                          if (next.has(kind)) next.delete(kind);
                          else next.add(kind);
                          return next;
                        });
                      }}
                      className={cn(
                        "flex w-full flex-col gap-2 rounded-2xl border bg-card p-2 text-left outline-none transition focus-visible:ring-[3px] focus-visible:ring-ring/50",
                        active
                          ? "border-foreground/40 shadow-sm"
                          : "border-border hover:border-foreground/20",
                        here && "cursor-default",
                      )}
                    >
                      <span className="block h-24 rounded-xl bg-secondary/60 p-2">
                        <DesignPreview
                          document={design}
                          fields={previewFields(
                            design.occasion,
                            design.language,
                            values,
                          )}
                          assets={assets}
                          className="size-full"
                        />
                      </span>
                      <span className="flex items-start justify-between gap-1 px-1 text-xs leading-snug font-medium">
                        {productKindLabels[kind][locale]}
                        {active ? (
                          <Check className="size-3.5 shrink-0" aria-hidden />
                        ) : null}
                      </span>
                      {here ? (
                        <span className="-mt-1.5 px-1 text-[11px] text-muted-foreground">
                          {t("simple.items.here")}
                        </span>
                      ) : null}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
          {writes && left === 0 ? (
            <p className="text-sm leading-relaxed text-muted-foreground">
              {t("simple.items.none")}
            </p>
          ) : writes && ordered.length > left ? (
            <p className="text-sm leading-relaxed text-muted-foreground">
              {t("simple.items.left", { count: left })}
            </p>
          ) : null}
        </div>
      );
      break;
    default:
      body = <div className="space-y-4">{step.fields.map(field)}</div>;
  }

  return (
    <section aria-labelledby={headingId} className="scroll-mt-5 space-y-5">
      <div className="flex items-center gap-3">
        <div
          className="h-1 flex-1 overflow-hidden rounded-full bg-secondary"
          aria-hidden
        >
          <div
            className="h-full rounded-full bg-gold transition-[width]"
            style={{ width: `${((index + 1) / steps.length) * 100}%` }}
          />
        </div>
        <p className="shrink-0 text-xs text-muted-foreground">
          {t("simple.progress", { current: index + 1, total: steps.length })}
        </p>
        <Button
          variant="ghost"
          size="icon"
          className="-mr-2 size-8"
          aria-label={t("simple.close")}
          title={t("simple.close")}
          onClick={() => {
            decline(event._id);
            go("closed");
          }}
        >
          <X aria-hidden />
        </Button>
      </div>
      <div className="space-y-1.5">
        <h2
          id={headingId}
          ref={headingRef}
          tabIndex={-1}
          className="font-display text-2xl leading-tight outline-none"
        >
          {words.title}
        </h2>
        <p className="text-sm leading-relaxed text-muted-foreground">
          {words.hint}
        </p>
      </div>
      {body}
      <div className="flex items-center gap-2 pt-1">
        {index > 0 ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => go("steps", index - 1)}
          >
            {t("simple.back")}
          </Button>
        ) : null}
        <div className="ml-auto">
          {last ? (
            <Button
              size="sm"
              disabled={busy || ordered.length === 0 || items.length === 0}
              onClick={() => void create()}
            >
              {busy ? (
                <LoaderCircle className="animate-spin" aria-hidden />
              ) : writes && left > 0 ? (
                <Sparkles aria-hidden />
              ) : null}
              {busy
                ? t("simple.creating")
                : writes && left > 0
                  ? t("simple.write")
                  : t("simple.create")}
            </Button>
          ) : (
            <Button
              size="sm"
              variant={answered ? "default" : "outline"}
              onClick={() => go("steps", index + 1)}
            >
              {answered ? t("simple.next") : t("simple.skip")}
            </Button>
          )}
        </div>
      </div>
    </section>
  );
}
