"use client";

import { api } from "@jolene/backend/convex/_generated/api";
import type { Id } from "@jolene/backend/convex/_generated/dataModel";
import { MAX_QUANTITY } from "@jolene/backend/convex/shop/pricing";
import {
  applyLook,
  type DesignDocument,
  type Look,
  type Operation,
  type ProductKind,
  stocks,
  waxHex,
} from "@jolene/design";
import { cn } from "@jolene/ui/utils";
import { useQuery } from "convex/react";
import { Minus, Plus, Slash } from "lucide-react";
import { type ReactNode, useId, useState } from "react";
import {
  type Choice,
  canSkip,
  chosenOptions,
  guestCount,
  isPaper,
  type LineOption,
  type Order,
  type OrderedProduct,
  type ProductOption,
} from "@/lib/finishes";
import { useI18n } from "@/locales/client";
import { usePrice } from "../suite/use-price";
import { type FinishesPick, type Track, useSetFinishes } from "./use-design";

/**
 * The Finisaje tab (ADR 0021): the product's papers and order options at
 * the shop's prices, how many, and what it all comes to. A pick that shows
 * changes the design as an edit does, so it can be undone; each is kept
 * with the design.
 */
export function FinishesPanel({
  designId,
  eventId,
  kind,
  document,
  product,
  order,
  apply,
  track,
}: {
  designId: Id<"designs">;
  eventId: Id<"events">;
  kind: ProductKind;
  document: DesignDocument;
  product: OrderedProduct;
  order: Order;
  apply: (operations: Operation[]) => void;
  track: Track;
}) {
  const pick = useSetFinishes(designId, track);
  const choose = (look: Look | null, picked: FinishesPick) => {
    if (look) {
      const operations = applyLook(document, look);
      if (operations.length > 0) apply(operations);
    }
    pick(picked);
  };

  return (
    <>
      <div className="min-h-0 flex-1 space-y-7 overflow-y-auto p-5">
        {product.options.map((option) => (
          <ValuesSection
            key={option.name}
            option={option}
            picked={order.values.get(option.name)?.name}
            onPick={(value) =>
              choose(value.look, {
                option: { name: option.name, value: value.name },
              })
            }
          />
        ))}
        {chosenOptions(product).map((option) => (
          <ChoicesSection
            key={option.key}
            option={option}
            picked={order.choices.get(option.key)}
            onPick={(choice) =>
              choose(choice?.look ?? null, {
                answer: { key: option.key, value: choice?.label ?? "" },
              })
            }
          />
        ))}
      </div>
      <QuantityBar
        eventId={eventId}
        kind={kind}
        order={order}
        onChange={(quantity) => pick({ quantity })}
      />
    </>
  );
}

/** What a pick adds to each one ordered, or that it's included. */
export function useAdds() {
  const t = useI18n();
  const price = usePrice();
  return {
    /** As a card writes it: "+1,50 lei". */
    short: (bani: number) =>
      bani === 0 ? t("finishes.included") : `+${price(bani)}`,
    /** As a summary writes it: "+1,50 lei / buc.". */
    each: (bani: number) =>
      bani === 0
        ? t("finishes.included")
        : t("finishes.extraEach", { price: price(bani) }),
  };
}

/** A paper's colour as its swatch shows it, pearl with a sheen. */
function paperSwatch(look: Look | null) {
  if (look?.kind !== "paper") return undefined;
  const stock = stocks[look.stock];
  const color = look.color ?? stock.color;
  return stock.texture === "pearl"
    ? `linear-gradient(135deg, ${color}, color-mix(in oklab, ${color} 78%, #d6cde6) 55%, ${color})`
    : color;
}

/** One of the product's options, such as its paper: a card for each value. */
function ValuesSection({
  option,
  picked,
  onPick,
}: {
  option: ProductOption;
  picked: string | undefined;
  onPick: (value: ProductOption["values"][number]) => void;
}) {
  const t = useI18n();
  const adds = useAdds();
  const chosen = option.values.find((value) => value.name === picked);
  return (
    <Section
      title={isPaper(option) ? t("design.paper") : option.name}
      summary={
        chosen
          ? `${chosen.name} · ${adds.each(chosen.surcharge)}`
          : t("finishes.choose")
      }
      missing={!chosen}
    >
      <div className="grid grid-cols-2 gap-2">
        {option.values.map((value) => (
          <Card
            key={value.name}
            label={value.name}
            detail={adds.short(value.surcharge)}
            active={value.name === picked}
            swatch={paperSwatch(value.look)}
            onSelect={() => onPick(value)}
          />
        ))}
      </div>
    </Section>
  );
}

/**
 * Whether every choice shows as a colour, or as none: a seal's wax, an
 * envelope's. One that shows nothing has no colour to show, so cards name
 * them all.
 */
const isSwatch = (option: LineOption) =>
  (option.shows === "seal" || option.shows === "envelope") &&
  option.choices.every(
    (choice) =>
      choice.look?.kind === "seal" || choice.look?.kind === "envelope",
  );

/** A choice of none and one that adds something, as preserved flowers. */
const isSwitch = (option: LineOption) => {
  const [off, on] = option.choices;
  return (
    !option.required &&
    option.choices.length === 2 &&
    off?.price === 0 &&
    (on?.price ?? 0) > 0
  );
};

/** One of the product's order options, as swatches, a switch or cards. */
function ChoicesSection({
  option,
  picked,
  onPick,
}: {
  option: LineOption;
  /** null when the couple leaves it out; undefined while it's to choose. */
  picked: Choice | null | undefined;
  /** null leaves it out. */
  onPick: (choice: Choice | null) => void;
}) {
  const t = useI18n();
  const adds = useAdds();
  const skippable = canSkip(option);
  const summary =
    picked === undefined
      ? t("finishes.choose")
      : picked === null
        ? t("finishes.none")
        : `${picked.label} · ${adds.each(picked.price)}`;
  const section = (children: ReactNode) => (
    <Section
      title={option.label}
      summary={summary}
      missing={picked === undefined}
    >
      {option.hint ? (
        <p className="-mt-1 mb-2.5 text-xs text-muted-foreground">
          {option.hint}
        </p>
      ) : null}
      {children}
    </Section>
  );

  if (isSwitch(option)) {
    const [off, on] = option.choices as [Choice, Choice];
    const checked = picked?.label === on.label;
    return section(
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onPick(checked ? off : on)}
        className={cn(
          "flex min-h-13 w-full items-center justify-between gap-3 rounded-xl border px-3 py-2 text-left outline-none transition focus-visible:ring-[3px] focus-visible:ring-ring/50",
          checked
            ? "border-foreground/40 bg-card shadow-sm"
            : "border-border hover:border-foreground/20",
        )}
      >
        <span className="flex flex-col">
          <span className="text-sm font-medium">{on.label}</span>
          <span className="text-xs text-muted-foreground">
            {adds.each(on.price)}
          </span>
        </span>
        <span
          className={cn(
            "flex h-5.5 w-9 shrink-0 rounded-full p-0.75 transition-colors",
            checked ? "justify-end bg-primary" : "bg-border",
          )}
          aria-hidden
        >
          <span className="size-4 rounded-full bg-white shadow-sm" />
        </span>
      </button>,
    );
  }

  if (isSwatch(option)) {
    const envelope = option.shows === "envelope";
    return section(
      <div className="-mx-2 flex flex-wrap">
        {skippable ? (
          <Swatch
            label={t("finishes.none")}
            color={null}
            square={envelope}
            active={picked === null}
            onSelect={() => onPick(null)}
          />
        ) : null}
        {option.choices.map((choice) => (
          <Swatch
            key={choice.label}
            label={`${choice.label}, ${adds.each(choice.price)}`}
            color={swatchColor(choice.look)}
            square={envelope}
            active={picked?.label === choice.label}
            onSelect={() => onPick(choice)}
          />
        ))}
      </div>,
    );
  }

  return section(
    <div className="grid grid-cols-2 gap-2">
      {skippable ? (
        <Card
          label={t("finishes.none")}
          active={picked === null}
          onSelect={() => onPick(null)}
        />
      ) : null}
      {option.choices.map((choice) => (
        <Card
          key={choice.label}
          label={choice.label}
          detail={adds.short(choice.price)}
          active={picked?.label === choice.label}
          onSelect={() => onPick(choice)}
        />
      ))}
    </div>,
  );
}

/** A seal's wax or an envelope's colour; null for none of them. */
function swatchColor(look: Look | null) {
  if (look?.kind === "seal") return look.color && waxHex(look.color);
  if (look?.kind === "envelope") return look.color;
  return null;
}

function Section({
  title,
  summary,
  missing,
  children,
}: {
  title: string;
  /** The pick and what it adds, or that it's to choose. */
  summary: string;
  missing: boolean;
  children: ReactNode;
}) {
  return (
    <section>
      <div className="mb-2.5 flex items-baseline justify-between gap-3">
        <h3 className="text-sm font-semibold">{title}</h3>
        <span
          className={cn(
            "truncate text-right text-xs",
            missing ? "font-medium text-foreground" : "text-muted-foreground",
          )}
        >
          {summary}
        </span>
      </div>
      {children}
    </section>
  );
}

/** A value or a choice as a card: its name, what it adds, a paper's colour. */
function Card({
  label,
  detail,
  active,
  swatch,
  onSelect,
}: {
  label: string;
  detail?: string;
  active: boolean;
  swatch?: string;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={active}
      className={cn(
        "flex min-h-13 items-center gap-2.5 rounded-xl border px-3 py-2 text-left outline-none transition focus-visible:ring-[3px] focus-visible:ring-ring/50",
        active
          ? "border-foreground/40 bg-card shadow-sm"
          : "border-border hover:border-foreground/20",
      )}
    >
      {swatch ? (
        <span
          className="size-4.5 shrink-0 rounded-full border border-black/15"
          style={{ background: swatch }}
          aria-hidden
        />
      ) : null}
      <span className="flex min-w-0 flex-col">
        <span className="text-[13px] font-medium leading-snug">{label}</span>
        {detail ? (
          <span className="text-xs text-muted-foreground">{detail}</span>
        ) : null}
      </span>
    </button>
  );
}

/** A colour to pick, its name for screen readers and on hover. */
function Swatch({
  label,
  color,
  square,
  active,
  onSelect,
}: {
  label: string;
  /** null for none: no seal, no envelope. */
  color: string | null;
  /** An envelope's, rounded square; a seal's is round. */
  square: boolean;
  active: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={active}
      aria-label={label}
      title={label}
      className="group flex size-11 items-center justify-center outline-none"
    >
      <span
        className={cn(
          "flex size-7 items-center justify-center text-muted-foreground ring-1 ring-black/15 ring-inset transition group-focus-visible:outline-[3px] group-focus-visible:outline-ring/50",
          square ? "rounded-lg" : "rounded-full",
          active
            ? "outline-2 outline-offset-2 outline-primary"
            : "group-hover:ring-black/30",
        )}
        style={
          color
            ? {
                background: square
                  ? color
                  : `radial-gradient(circle at 35% 30%, color-mix(in oklab, ${color} 60%, white), ${color} 55%, color-mix(in oklab, ${color} 70%, black))`,
              }
            : undefined
        }
      >
        {color ? null : <Slash className="size-4" aria-hidden />}
      </span>
    </button>
  );
}

/**
 * How many, what one comes to and the total, under the picks: on a phone it
 * stays at the bottom of the screen, above the AI designer when it's open.
 */
function QuantityBar({
  eventId,
  kind,
  order,
  onChange,
}: {
  eventId: Id<"events">;
  kind: ProductKind;
  order: Order;
  onChange: (quantity: number) => void;
}) {
  const t = useI18n();
  const price = usePrice();
  const id = useId();
  const list = useQuery(api.invites.listSize, { eventId });
  const guests = list ? guestCount(kind, list) : null;
  return (
    <div className="sticky bottom-[var(--ai-sheet-height,0px)] z-10 space-y-2 border-t border-border/70 bg-card px-5 pt-3.5 pb-4 lg:static">
      <div className="flex items-end justify-between gap-3">
        <div className="flex flex-col gap-1.5">
          <label htmlFor={id} className="text-xs text-muted-foreground">
            {t("finishes.quantity")}
          </label>
          <Stepper
            id={id}
            value={order.quantity}
            min={order.minQuantity}
            onChange={onChange}
          />
        </div>
        <div className="flex flex-col items-end gap-1" aria-live="polite">
          <span className="text-xs text-muted-foreground">
            {t("finishes.each", { price: price(order.price) })}
          </span>
          <span className="font-display text-3xl leading-none">
            {price(order.total)}
          </span>
        </div>
      </div>
      {order.minQuantity > 1 || guests ? (
        <p className="text-xs leading-relaxed text-muted-foreground">
          {order.minQuantity > 1
            ? t("finishes.minimum", { count: order.minQuantity })
            : null}
          {order.minQuantity > 1 && guests ? " " : null}
          {guests ? t(`finishes.${guests.of}`, { count: guests.count }) : null}
        </p>
      ) : null}
    </div>
  );
}

/**
 * How many, by a step or typed: a typed number counts once the field loses
 * focus or Enter is pressed, so 120 isn't sent as 1, then 12.
 */
function Stepper({
  id,
  value,
  min,
  onChange,
}: {
  id: string;
  value: number;
  min: number;
  onChange: (quantity: number) => void;
}) {
  const t = useI18n();
  const [draft, setDraft] = useState<string>();
  const commit = () => {
    if (draft === undefined) return;
    setDraft(undefined);
    const typed = Number.parseInt(draft, 10);
    if (Number.isNaN(typed)) return;
    const quantity = Math.min(Math.max(typed, min), MAX_QUANTITY);
    if (quantity !== value) onChange(quantity);
  };
  const step =
    "flex size-10 items-center justify-center rounded-full outline-none transition hover:bg-secondary focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-40";
  return (
    <div className="inline-flex items-center rounded-full border border-input bg-background">
      <button
        type="button"
        aria-label={t("finishes.fewer")}
        disabled={value <= min}
        onClick={() => onChange(value - 1)}
        className={step}
      >
        <Minus className="size-4" aria-hidden />
      </button>
      <input
        id={id}
        inputMode="numeric"
        autoComplete="off"
        value={draft ?? String(value)}
        onChange={(event) => setDraft(event.target.value.replace(/\D/g, ""))}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key !== "Enter") return;
          event.preventDefault();
          commit();
        }}
        className="h-10 w-12 bg-transparent text-center text-[15px] font-semibold tabular-nums outline-none"
      />
      <button
        type="button"
        aria-label={t("finishes.more")}
        disabled={value >= MAX_QUANTITY}
        onClick={() => onChange(value + 1)}
        className={step}
      >
        <Plus className="size-4" aria-hidden />
      </button>
    </div>
  );
}
