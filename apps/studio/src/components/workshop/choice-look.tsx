"use client";

import {
  type ChoiceLookKind,
  HEX_PATTERN,
  type Look,
  type RibbonMaterial,
  ribbonMaterialLabels,
  ribbonMaterials,
} from "@jolene/design";
import { Input } from "@jolene/ui/input";
import { Pipette } from "lucide-react";
import { useId } from "react";
import { useCurrentLocale, useI18n } from "@/locales/client";

type Locale = ReturnType<typeof useCurrentLocale>;

/** What choosing a choice does to a design in the studio, as the form picks it. */
type LookMode =
  | "hidden"
  | "seal"
  | "noSeal"
  | "envelope"
  | RibbonMaterial
  | "noRibbon"
  | "printed"
  | "plain"
  | "rounded"
  | "square";

/** What each option can do to a design, the usual first; nothing last. */
const modes: Record<ChoiceLookKind, readonly LookMode[]> = {
  seal: ["seal", "noSeal", "hidden"],
  envelope: ["envelope", "hidden"],
  ribbon: [...ribbonMaterials, "noRibbon", "hidden"],
  liner: ["printed", "plain", "hidden"],
  corners: ["rounded", "square", "hidden"],
};

/** The colour a choice starts from when it's given one: gold wax, an ivory ribbon. */
const startColor = (kind: ChoiceLookKind) =>
  kind === "seal" ? "#B8913A" : kind === "ribbon" ? "#F3EEE4" : "#FFFFFF";

/** Rounded corners' radius when a choice is first given them, in mm. */
const ROUNDED = 4;

/** The most a corner can be rounded, in mm (lookSchema). */
const MOST_RADIUS = 20;

const selectClass =
  "h-9 min-w-0 rounded-lg border border-input bg-card px-2.5 text-sm shadow-xs outline-none transition-[border-color,box-shadow] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/30";

const isMaterial = (mode: LookMode): mode is RibbonMaterial =>
  (ribbonMaterials as readonly LookMode[]).includes(mode);

/** A choice's look in the form: what it does, and its colour or corners as typed. */
export interface LookDraft {
  mode: LookMode;
  /** The wax's, the envelope's or a ribbon's own colour. */
  color: string;
  /** Whether a ribbon has a colour of its own; else it keeps the design's. */
  ownColor: boolean;
  /** Rounded corners' radius, in millimetres. */
  radius: string;
}

const millimetres = (mm: number, locale: Locale) =>
  locale === "ro" ? String(mm).replace(".", ",") : String(mm);

/** The form's draft of a choice's look; null shows nothing. */
export function lookDraft(
  kind: ChoiceLookKind,
  look: Look | null,
  locale: Locale,
): LookDraft {
  const draft: LookDraft = {
    mode: "hidden",
    color: startColor(kind),
    ownColor: false,
    radius: millimetres(ROUNDED, locale),
  };
  switch (look?.kind) {
    case "seal":
      return look.color === null
        ? { ...draft, mode: "noSeal" }
        : { ...draft, mode: "seal", color: look.color.toUpperCase() };
    case "envelope":
      return { ...draft, mode: "envelope", color: look.color.toUpperCase() };
    case "ribbon":
      return look.material === null
        ? { ...draft, mode: "noRibbon" }
        : {
            ...draft,
            mode: look.material,
            ownColor: look.color !== null,
            color: look.color?.toUpperCase() ?? draft.color,
          };
    case "liner":
      return { ...draft, mode: look.printed ? "printed" : "plain" };
    case "corners":
      return look.radius === 0
        ? { ...draft, mode: "square" }
        : {
            ...draft,
            mode: "rounded",
            radius: millimetres(look.radius, locale),
          };
    default:
      return draft;
  }
}

/** A colour as typed, such as #A1B2C3 or a1b2c3; null for anything else. */
function readColor(text: string) {
  const trimmed = text.trim();
  const color = trimmed.startsWith("#") ? trimmed : `#${trimmed}`;
  return HEX_PATTERN.test(color) ? color.toLowerCase() : null;
}

/** A radius as typed, such as 4, 2,5 or 2.5 mm; null for one that can't be. */
function readRadius(text: string) {
  const match = /^\s*(\d{1,2})(?:[.,](\d))?\s*(?:mm)?\s*$/i.exec(text);
  if (!match) return null;
  const radius = Number(`${match[1]}.${match[2] ?? "0"}`);
  return radius > 0 && radius <= MOST_RADIUS ? radius : null;
}

/**
 * The look a draft saves: null when it shows nothing, undefined when its
 * colour or radius isn't one.
 */
export function readLook(draft: LookDraft): Look | null | undefined {
  const color = readColor(draft.color);
  switch (draft.mode) {
    case "hidden":
      return null;
    case "seal":
      return color === null ? undefined : { kind: "seal", color };
    case "noSeal":
      return { kind: "seal", color: null };
    case "envelope":
      return color === null ? undefined : { kind: "envelope", color };
    case "noRibbon":
      return { kind: "ribbon", material: null, color: null };
    case "printed":
    case "plain":
      return { kind: "liner", printed: draft.mode === "printed" };
    case "square":
      return { kind: "corners", radius: 0 };
    case "rounded": {
      const radius = readRadius(draft.radius);
      return radius === null ? undefined : { kind: "corners", radius };
    }
    default:
      if (!draft.ownColor)
        return { kind: "ribbon", material: draft.mode, color: null };
      return color === null
        ? undefined
        : { kind: "ribbon", material: draft.mode, color };
  }
}

/**
 * How the studio shows a choice on a design, by what its option changes:
 * the seal's wax or none, the envelope's colour, the ribbon or none, the
 * liner, the corners; or nothing, for a choice ordered in words only.
 */
export function ChoiceLookField({
  kind,
  number,
  draft,
  onChange,
}: {
  kind: ChoiceLookKind;
  /** The choice's number in the list, for the fields' names. */
  number: number;
  draft: LookDraft;
  onChange: (draft: LookDraft) => void;
}) {
  const t = useI18n();
  const locale = useCurrentLocale();
  const id = useId();
  const colored =
    draft.mode === "seal" ||
    draft.mode === "envelope" ||
    (isMaterial(draft.mode) && draft.ownColor);
  const rounded = draft.mode === "rounded";
  const color = readColor(draft.color);
  // Only a colour or a radius can be wrong.
  const invalid = readLook(draft) === undefined;
  const problem = !invalid
    ? null
    : rounded
      ? t("workshop.lineOptions.looks.problems.radius", { most: MOST_RADIUS })
      : t("workshop.lineOptions.looks.problems.color");
  const label = (mode: LookMode) =>
    isMaterial(mode)
      ? ribbonMaterialLabels[mode][locale]
      : t(`workshop.lineOptions.looks.${mode}`);
  return (
    <div className="flex basis-full flex-col gap-1.5 pl-9">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-muted-foreground" aria-hidden>
          {t("workshop.lineOptions.looks.inStudio")}
        </span>
        <select
          value={draft.mode}
          aria-label={t("workshop.lineOptions.looks.of", { number })}
          onChange={(event) =>
            onChange({ ...draft, mode: event.target.value as LookMode })
          }
          className={selectClass}
        >
          {modes[kind].map((mode) => (
            <option key={mode} value={mode}>
              {label(mode)}
            </option>
          ))}
        </select>
        {isMaterial(draft.mode) ? (
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={draft.ownColor}
              onChange={(event) =>
                onChange({ ...draft, ownColor: event.target.checked })
              }
              className="size-4 accent-foreground"
            />
            {t("workshop.lineOptions.looks.ownColor")}
          </label>
        ) : null}
        {colored ? (
          <div className="flex items-center gap-2">
            <label
              className="relative flex size-9 shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-lg border border-input"
              style={{ background: color ?? startColor(kind) }}
              title={t("workshop.lineOptions.looks.pick")}
            >
              <Pipette
                className="size-3.5 text-white mix-blend-difference"
                aria-hidden
              />
              <input
                type="color"
                value={color ?? startColor(kind).toLowerCase()}
                aria-label={t("workshop.lineOptions.looks.pickOf", { number })}
                onChange={(event) =>
                  onChange({
                    ...draft,
                    color: event.target.value.toUpperCase(),
                  })
                }
                className="absolute inset-0 cursor-pointer opacity-0"
              />
            </label>
            <Input
              value={draft.color}
              maxLength={7}
              spellCheck={false}
              placeholder="#A1B2C3"
              aria-label={t("workshop.lineOptions.looks.colorOf", { number })}
              aria-invalid={invalid || undefined}
              aria-describedby={problem ? `${id}-problem` : undefined}
              onChange={(event) =>
                onChange({ ...draft, color: event.target.value })
              }
              className="h-9 w-28 font-mono uppercase"
            />
          </div>
        ) : null}
        {rounded ? (
          <div className="flex items-center gap-2">
            <Input
              value={draft.radius}
              inputMode="decimal"
              autoComplete="off"
              aria-label={t("workshop.lineOptions.looks.radiusOf", { number })}
              aria-invalid={invalid || undefined}
              aria-describedby={problem ? `${id}-problem` : undefined}
              onChange={(event) =>
                onChange({ ...draft, radius: event.target.value })
              }
              className="h-9 w-16"
            />
            <span className="text-sm text-muted-foreground" aria-hidden>
              mm
            </span>
          </div>
        ) : null}
      </div>
      {problem ? (
        <p id={`${id}-problem`} className="text-xs text-destructive">
          {problem}
        </p>
      ) : null}
    </div>
  );
}
