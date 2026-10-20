"use client";

import {
  type ColorRef,
  HEX_PATTERN,
  type Hex,
  type Palette,
  type PaletteToken,
  paletteTokens,
  resolveColor,
} from "@jolene/design";
import { Popover, PopoverContent, PopoverTrigger } from "@jolene/ui/popover";
import { cn } from "@jolene/ui/utils";
import { Check, Pipette, RotateCcw } from "lucide-react";
import {
  type ChangeEvent,
  type KeyboardEvent,
  type ReactNode,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import { useCurrentLocale, useI18n } from "@/locales/client";

/** A titled group of controls in the inspector. */
export function Section({
  title,
  action,
  children,
}: {
  title: ReactNode;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="border-b border-border/70 px-4 py-4 last:border-b-0">
      <div className="mb-3 flex min-h-5 items-center justify-between gap-2">
        <h3 className="text-[11px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
          {title}
        </h3>
        {action}
      </div>
      <div className="space-y-2.5">{children}</div>
    </section>
  );
}

/** A label to the left of its control, as one line of the inspector. */
export function Row({
  label,
  htmlFor,
  reset,
  children,
}: {
  label: ReactNode;
  htmlFor?: string;
  /** Shown when the value differs from where it comes from, to go back. */
  reset?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="grid grid-cols-[5.5rem_minmax(0,1fr)] items-center gap-2">
      <div className="flex min-w-0 items-center gap-1">
        <label
          htmlFor={htmlFor}
          className="truncate text-[12px] text-muted-foreground"
        >
          {label}
        </label>
        {reset}
      </div>
      <div className="flex min-w-0 items-center gap-1.5">{children}</div>
    </div>
  );
}

/** A small button that puts a property back to what the style says. */
export function ResetButton({
  label,
  onReset,
}: {
  label: string;
  onReset: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onReset}
      title={label}
      aria-label={label}
      className="flex size-4 shrink-0 items-center justify-center rounded text-gold outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50"
    >
      <RotateCcw className="size-3" aria-hidden />
    </button>
  );
}

export const controlClass =
  "h-8 w-full min-w-0 rounded-lg border border-input bg-card px-2 text-[13px] outline-none transition-[border-color,box-shadow] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/30 disabled:cursor-not-allowed disabled:opacity-50";

/** Numbers as the visitor writes them: "12,5" in Romanian, "12.5" in English. */
function useNumberFormat(decimals: number) {
  const locale = useCurrentLocale();
  const format = (value: number) => {
    const rounded = Number(value.toFixed(decimals));
    const text = String(Object.is(rounded, -0) ? 0 : rounded);
    return locale === "ro" ? text.replace(".", ",") : text;
  };
  const parse = (text: string): number | null => {
    const value = Number(text.trim().replace(",", "."));
    return text.trim() !== "" && Number.isFinite(value) ? value : null;
  };
  return { format, parse };
}

/**
 * A number the visitor types or steps with the arrow keys (Shift for ten
 * steps). It commits once, on Enter or on leaving the field, so typing
 * doesn't fill the history; steps show at once through `onPreview`.
 */
export function NumberField({
  label,
  name,
  value,
  onCommit,
  onPreview,
  unit,
  step = 1,
  min = Number.NEGATIVE_INFINITY,
  max = Number.POSITIVE_INFINITY,
  decimals = 1,
  disabled,
  id,
  className,
}: {
  /** A letter or two inside the field, such as "X" or "L". */
  label?: string;
  /** What the field holds, for screen readers and as a tip, when `label` is a sign. */
  name?: string;
  value: number;
  onCommit: (value: number) => void;
  onPreview?: (value: number | null) => void;
  unit?: string;
  step?: number;
  min?: number;
  max?: number;
  decimals?: number;
  disabled?: boolean;
  id?: string;
  className?: string;
}) {
  const { format, parse } = useNumberFormat(decimals);
  const [draft, setDraft] = useState<string | null>(null);
  const clamp = (next: number) =>
    Number(Math.min(max, Math.max(min, next)).toFixed(decimals));

  const commit = (text: string | null) => {
    setDraft(null);
    onPreview?.(null);
    if (text === null) return;
    const parsed = parse(text);
    if (parsed === null) return;
    const next = clamp(parsed);
    if (next !== clamp(value)) onCommit(next);
  };

  // A draft left behind when the field goes away (another layer chosen)
  // still counts, for the layer it was typed for.
  const pending = useRef({ draft, commit });
  useEffect(() => {
    pending.current = { draft, commit };
  });
  useEffect(
    () => () => {
      const { draft: left, commit: finish } = pending.current;
      if (left !== null) finish(left);
    },
    [],
  );

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      commit(draft);
      event.currentTarget.select();
    } else if (event.key === "Escape") {
      setDraft(null);
      onPreview?.(null);
      event.currentTarget.blur();
    } else if (event.key === "ArrowUp" || event.key === "ArrowDown") {
      event.preventDefault();
      const from = parse(draft ?? format(value)) ?? value;
      const by = (event.shiftKey ? 10 : 1) * step;
      const next = clamp(from + (event.key === "ArrowUp" ? by : -by));
      setDraft(format(next));
      onPreview?.(next);
    }
  };

  return (
    <div
      className={cn(
        "flex h-8 min-w-0 flex-1 items-center rounded-lg border border-input bg-card text-[13px] transition-[border-color,box-shadow] focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/30",
        disabled && "opacity-50",
        className,
      )}
    >
      {label ? (
        <span
          className="w-6 shrink-0 select-none pl-2 text-[11px] text-muted-foreground"
          aria-hidden
        >
          {label}
        </span>
      ) : null}
      <input
        id={id}
        type="text"
        inputMode="decimal"
        aria-label={name ?? label}
        title={name}
        disabled={disabled}
        value={draft ?? format(value)}
        onFocus={(event) => {
          setDraft(format(value));
          event.currentTarget.select();
        }}
        onChange={(event: ChangeEvent<HTMLInputElement>) =>
          setDraft(event.target.value)
        }
        onBlur={() => commit(draft)}
        onKeyDown={onKeyDown}
        className="h-full w-full min-w-0 bg-transparent px-2 tabular-nums outline-none disabled:cursor-not-allowed"
      />
      {unit ? (
        <span
          className="shrink-0 select-none pr-2 text-[11px] text-muted-foreground"
          aria-hidden
        >
          {unit}
        </span>
      ) : null}
    </div>
  );
}

/**
 * Text that commits on Enter or on leaving the field, such as a layer's
 * name. Empty, it commits as empty.
 */
export function TextField({
  value,
  onCommit,
  placeholder,
  id,
  label,
  maxLength,
  className,
}: {
  value: string;
  onCommit: (value: string) => void;
  placeholder?: string;
  id?: string;
  /** For screen readers, when no visible label points at it. */
  label?: string;
  maxLength?: number;
  className?: string;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const commit = () => {
    if (draft !== null && draft.trim() !== value) onCommit(draft.trim());
    setDraft(null);
  };
  const pending = useRef({ draft, commit });
  useEffect(() => {
    pending.current = { draft, commit };
  });
  useEffect(
    () => () => {
      if (pending.current.draft !== null) pending.current.commit();
    },
    [],
  );
  return (
    <input
      id={id}
      type="text"
      aria-label={label}
      value={draft ?? value}
      placeholder={placeholder}
      maxLength={maxLength}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === "Enter") event.currentTarget.blur();
        if (event.key === "Escape") {
          setDraft(null);
          // Blur after the draft is gone, so nothing commits.
          const input = event.currentTarget;
          requestAnimationFrame(() => input.blur());
        }
      }}
      className={cn(controlClass, className)}
    />
  );
}

/** A native select, quiet like the other controls. */
export function Select<T extends string>({
  value,
  options,
  onChange,
  id,
  disabled,
  label,
}: {
  value: T;
  options: readonly { value: T; label: string }[];
  onChange: (value: T) => void;
  id?: string;
  disabled?: boolean;
  /** For screen readers, when no visible label points at it. */
  label?: string;
}) {
  return (
    <select
      id={id}
      value={value}
      disabled={disabled}
      aria-label={label}
      // A long choice, such as a paper's name, can be cut short.
      title={options.find((option) => option.value === value)?.label}
      onChange={(event) => onChange(event.target.value as T)}
      className={cn(controlClass, "pr-6")}
    >
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}

/** One of a few choices shown as icons, such as text alignment. */
export function IconChoice<T extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: T | null;
  options: readonly { value: T; label: string; icon: ReactNode }[];
  onChange: (value: T) => void;
  label: string;
}) {
  return (
    <fieldset
      aria-label={label}
      className="m-0 flex h-8 min-w-0 items-center gap-0.5 rounded-lg border-0 bg-secondary p-0.5"
    >
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={value === option.value}
          aria-label={option.label}
          title={option.label}
          onClick={() => onChange(option.value)}
          className="flex h-7 flex-1 items-center justify-center rounded-md px-1.5 text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50 aria-pressed:bg-card aria-pressed:text-foreground aria-pressed:shadow-sm [&_svg]:size-4"
        >
          {option.icon}
        </button>
      ))}
    </fieldset>
  );
}

/** An on/off button with an icon, such as italic or a flip. */
export function IconToggle({
  pressed,
  onChange,
  label,
  disabled,
  children,
}: {
  pressed: boolean;
  onChange: (pressed: boolean) => void;
  label: string;
  disabled?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={() => onChange(!pressed)}
      className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-input bg-card text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/30 disabled:pointer-events-none disabled:opacity-40 aria-pressed:border-foreground/30 aria-pressed:bg-secondary aria-pressed:text-foreground [&_svg]:size-4"
    >
      {children}
    </button>
  );
}

/** A bordered square button with an icon, such as "duplicate". */
export function SquareButton({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-input bg-card text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/30 disabled:pointer-events-none disabled:opacity-40 [&_svg]:size-4"
    >
      {children}
    </button>
  );
}

/** A square button with an icon, for one-click actions such as "to front". */
export function IconAction({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className="flex h-8 flex-1 items-center justify-center rounded-lg text-muted-foreground outline-none transition-colors hover:bg-secondary hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/30 disabled:pointer-events-none disabled:opacity-40 [&_svg]:size-4"
    >
      {children}
    </button>
  );
}

/** A colour from the palette, or of the visitor's own. */
export function ColorField({
  value,
  palette,
  onChange,
  noneLabel,
  id,
}: {
  value: ColorRef | null;
  palette: Palette;
  onChange: (value: ColorRef | null) => void;
  /** Offers "none" under this name, as for a fill or a tint. */
  noneLabel?: string;
  id?: string;
}) {
  const t = useI18n();
  const shown = value ? resolveColor(value, palette) : null;
  const token = value?.startsWith("$")
    ? (value.slice(1) as PaletteToken)
    : null;
  const name = !value
    ? (noneLabel ?? "")
    : token
      ? t(`expert.palette.${token}`)
      : value.toUpperCase();
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          id={id}
          type="button"
          className={cn(
            controlClass,
            "flex items-center gap-2 text-left hover:border-foreground/25",
          )}
        >
          <Swatch color={shown} />
          <span className="truncate">{name}</span>
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-64 space-y-3">
        <div>
          <p className="mb-2 text-[11px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
            {t("expert.color.palette")}
          </p>
          <div className="grid grid-cols-5 gap-1.5">
            {paletteTokens.map((option) => {
              const ref = `$${option}` as ColorRef;
              return (
                <button
                  key={option}
                  type="button"
                  onClick={() => onChange(ref)}
                  aria-pressed={value === ref}
                  title={t(`expert.palette.${option}`)}
                  aria-label={t(`expert.palette.${option}`)}
                  className="group flex flex-col items-center gap-1 rounded-lg p-1 outline-none hover:bg-secondary focus-visible:ring-2 focus-visible:ring-ring/50"
                >
                  <span
                    className="relative flex size-7 items-center justify-center rounded-full border border-black/10 shadow-inner group-aria-pressed:ring-2 group-aria-pressed:ring-foreground/60 group-aria-pressed:ring-offset-1 group-aria-pressed:ring-offset-popover"
                    style={{ background: palette[option] }}
                  />
                  <span className="w-full truncate text-center text-[10px] text-muted-foreground">
                    {t(`expert.palette.${option}`)}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
        <CustomColor
          value={value && !token ? value : null}
          start={shown ?? palette.ink}
          onChange={onChange}
        />
        {noneLabel ? (
          <button
            type="button"
            onClick={() => onChange(null)}
            aria-pressed={value === null}
            className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-[13px] outline-none hover:bg-secondary focus-visible:ring-2 focus-visible:ring-ring/50"
          >
            <Swatch color={null} />
            <span className="flex-1 text-left">{noneLabel}</span>
            {value === null ? <Check className="size-4" aria-hidden /> : null}
          </button>
        ) : null}
      </PopoverContent>
    </Popover>
  );
}

/** A colour shown as a dot; none is a struck-through circle. */
export function Swatch({ color }: { color: string | null }) {
  return (
    <span
      className="relative size-4 shrink-0 overflow-hidden rounded-full border border-black/15"
      style={{ background: color ?? "transparent" }}
      aria-hidden
    >
      {color ? null : (
        <span className="absolute top-1/2 left-1/2 h-px w-5 -translate-x-1/2 -translate-y-1/2 -rotate-45 bg-destructive/70" />
      )}
    </span>
  );
}

/** A colour that is always a hex value, such as one of the palette's own. */
export function HexField({
  value,
  onChange,
  id,
}: {
  value: Hex;
  onChange: (value: Hex) => void;
  id?: string;
}) {
  return (
    <CustomColor
      value={value}
      start={value}
      onChange={(color) => onChange(color as Hex)}
      id={id}
    />
  );
}

/** The browser's colour picker and a hex field, for a colour of one's own. */
function CustomColor({
  value,
  start,
  onChange,
  id: given,
}: {
  value: string | null;
  start: string;
  onChange: (value: ColorRef) => void;
  /** Without one, the field has its own heading. */
  id?: string;
}) {
  const t = useI18n();
  const own = useId();
  const id = given ?? own;
  const picker = useRef<HTMLInputElement>(null);
  const [hex, setHex] = useState<string | null>(null);
  // The native picker reports every shade it passes through; only the one
  // it closes on is a change.
  const latest = useRef(onChange);
  useEffect(() => {
    latest.current = onChange;
  });
  useEffect(() => {
    const input = picker.current;
    if (!input) return;
    const onPicked = () =>
      latest.current(input.value.toLowerCase() as ColorRef);
    input.addEventListener("change", onPicked);
    return () => input.removeEventListener("change", onPicked);
  }, []);
  const commitHex = () => {
    if (hex === null) return;
    const candidate = hex.startsWith("#") ? hex : `#${hex}`;
    if (HEX_PATTERN.test(candidate))
      onChange(candidate.toLowerCase() as ColorRef);
    setHex(null);
  };
  // The picker follows the colour when it changes from elsewhere.
  useEffect(() => {
    if (picker.current && value) picker.current.value = value;
  }, [value]);
  return (
    <div className="min-w-0 flex-1">
      {given ? null : (
        <label
          htmlFor={id}
          className="mb-2 block text-[11px] font-medium uppercase tracking-[0.2em] text-muted-foreground"
        >
          {t("expert.color.custom")}
        </label>
      )}
      <div className="flex items-center gap-2">
        <label
          className="relative flex size-8 shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-lg border border-input"
          style={{ background: value ?? start }}
          title={t("expert.color.pick")}
        >
          <Pipette
            className="size-3.5 text-white mix-blend-difference"
            aria-hidden
          />
          <input
            ref={picker}
            type="color"
            defaultValue={value ?? start}
            aria-label={t("expert.color.pick")}
            className="absolute inset-0 cursor-pointer opacity-0"
          />
        </label>
        <input
          id={id}
          type="text"
          value={hex ?? (value ?? "").toUpperCase()}
          placeholder="#A1B2C3"
          maxLength={7}
          spellCheck={false}
          onChange={(event) => setHex(event.target.value)}
          onBlur={commitHex}
          onKeyDown={(event) => {
            if (event.key === "Enter") commitHex();
          }}
          className={cn(controlClass, "font-mono uppercase")}
        />
      </div>
    </div>
  );
}
