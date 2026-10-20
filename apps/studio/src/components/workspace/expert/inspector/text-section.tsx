"use client";

import {
  clearOverrides,
  type DesignDocument,
  dateFormats,
  type FaceRef,
  type Fields,
  type FontFamilyName,
  fieldsFor,
  fontFamilies,
  formatDate,
  type LayerChanges,
  layoutText,
  type Operation,
  replaceLayer,
  resolveText,
  type TextLayer,
  type TextStyle,
  type TextStyleToken,
  textStyleTokens,
} from "@jolene/design";
import { useCanvasMeasure } from "@jolene/design/react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@jolene/ui/dropdown-menu";
import {
  AlignVerticalJustifyCenter,
  AlignVerticalJustifyEnd,
  AlignVerticalJustifyStart,
  Braces,
  CaseLower,
  CaseSensitive,
  CaseUpper,
  CircleAlert,
  Italic,
  TextAlignCenter,
  TextAlignEnd,
  TextAlignStart,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useCurrentLocale, useI18n } from "@/locales/client";
import {
  ColorField,
  IconChoice,
  IconToggle,
  NumberField,
  ResetButton,
  Row,
  Section,
  Select,
} from "./fields";
import { FontPicker } from "./font-picker";

/** How long typing pauses before the words are kept, in milliseconds. */
const COMMIT_DELAY_MS = 700;

const weightNames = {
  100: "thin",
  200: "extraLight",
  300: "light",
  400: "regular",
  500: "medium",
  600: "semibold",
  700: "bold",
  800: "extraBold",
  900: "black",
} as const;
type WeightName = (typeof weightNames)[keyof typeof weightNames];
const weightName = (weight: number): WeightName =>
  weightNames[weight as keyof typeof weightNames] ?? "regular";

/** Asks the text field to take the cursor; `n` changes with each request. */
export interface TextFocus {
  id: string;
  /** Select every word, as for a new layer's placeholder. */
  select: boolean;
  n: number;
}

/**
 * A text layer's words and type. The words show on the canvas as they're
 * typed and are kept each time typing pauses; the type follows the layer's
 * style unless changed here, and each change can go back to the style.
 */
export function TextSection({
  document,
  target,
  layer,
  fields,
  apply,
  onPreview,
  focus,
}: {
  document: DesignDocument;
  target: FaceRef;
  layer: TextLayer;
  fields: Fields;
  apply: (operations: Operation[]) => void;
  onPreview: (changes: LayerChanges | null) => void;
  focus: TextFocus | null;
}) {
  const t = useI18n();
  const style: TextStyle = {
    ...document.theme.text[layer.style],
    ...layer.overrides,
  };
  const set = (changes: LayerChanges) =>
    apply([{ op: "updateLayer", ...target, layer: layer.id, set: changes }]);
  const override = (changes: LayerChanges["overrides"]) =>
    set({ overrides: changes });
  const overridden = (key: keyof TextStyle) =>
    Object.hasOwn(layer.overrides, key);
  const reset = (...keys: (keyof TextStyle)[]) =>
    overridden(keys[0] as keyof TextStyle) ? (
      <ResetButton
        label={t("expert.text.reset")}
        onReset={() => apply(clearOverrides(document, target, layer.id, keys))}
      />
    ) : null;
  const family = fontFamilies[style.font];
  const id = (name: string) => `${name}-${layer.id}`;

  const changeFont = (font: FontFamilyName) => {
    const offered = fontFamilies[font];
    // The nearest weight the new face has, and italic only where it has one.
    const weights: readonly number[] = offered.weights;
    const weight = weights.includes(style.weight)
      ? undefined
      : weights.reduce((best, candidate) =>
          Math.abs(candidate - style.weight) < Math.abs(best - style.weight)
            ? candidate
            : best,
        );
    override({
      font,
      ...(weight === undefined ? {} : { weight }),
      ...(style.italic && !offered.italic ? { italic: false } : {}),
    });
  };

  return (
    <>
      <Section title={t("expert.text.words")}>
        <Words
          layer={layer}
          document={document}
          fields={fields}
          onCommit={(text) => set({ text })}
          onPreview={(text) => onPreview(text === null ? null : { text })}
          focus={focus}
        />
        <Overflow document={document} layer={layer} fields={fields} />
      </Section>

      <Section title={t("expert.text.type")}>
        <Row label={t("expert.text.style")} htmlFor={id("style")}>
          <Select
            id={id("style")}
            value={layer.style}
            options={textStyleTokens.map((token: TextStyleToken) => ({
              value: token,
              label: t(`expert.textStyle.${token}`),
            }))}
            onChange={(next) => set({ style: next })}
          />
        </Row>
        <Row
          label={t("expert.text.font")}
          htmlFor={id("font")}
          reset={reset("font", "weight", "italic")}
        >
          <FontPicker
            id={id("font")}
            value={style.font}
            onChange={changeFont}
          />
        </Row>
        <Row
          label={t("expert.text.size")}
          htmlFor={id("size")}
          reset={reset("size")}
        >
          <NumberField
            id={id("size")}
            unit="pt"
            value={style.size}
            step={0.5}
            min={1}
            max={400}
            onCommit={(size) => override({ size })}
            onPreview={(size) =>
              onPreview(size === null ? null : { overrides: { size } })
            }
          />
        </Row>
        <Row
          label={t("expert.text.weight")}
          htmlFor={id("weight")}
          reset={reset("weight")}
        >
          <Select
            id={id("weight")}
            value={String(style.weight)}
            disabled={family.weights.length < 2}
            options={[...new Set([...family.weights, style.weight])].map(
              (weight) => ({
                value: String(weight),
                label: t(`expert.weight.${weightName(weight)}`),
              }),
            )}
            onChange={(weight) => override({ weight: Number(weight) })}
          />
          <IconToggle
            pressed={style.italic}
            disabled={!family.italic && !style.italic}
            onChange={(italic) => override({ italic })}
            label={t("expert.text.italic")}
          >
            <Italic />
          </IconToggle>
        </Row>
        <Row label={t("expert.text.case")} reset={reset("case")}>
          <IconChoice
            label={t("expert.text.case")}
            value={style.case}
            onChange={(next) => override({ case: next })}
            options={[
              {
                value: "none",
                label: t("expert.text.caseNone"),
                icon: <CaseSensitive />,
              },
              {
                value: "upper",
                label: t("expert.text.caseUpper"),
                icon: <CaseUpper />,
              },
              {
                value: "lower",
                label: t("expert.text.caseLower"),
                icon: <CaseLower />,
              },
            ]}
          />
        </Row>
        <Row
          label={t("expert.text.tracking")}
          htmlFor={id("tracking")}
          reset={reset("tracking")}
        >
          <NumberField
            id={id("tracking")}
            value={style.tracking}
            step={10}
            min={-200}
            max={1000}
            decimals={0}
            onCommit={(tracking) => override({ tracking })}
            onPreview={(tracking) =>
              onPreview(tracking === null ? null : { overrides: { tracking } })
            }
          />
        </Row>
        <Row
          label={t("expert.text.lineHeight")}
          htmlFor={id("leading")}
          reset={reset("lineHeight")}
        >
          <NumberField
            id={id("leading")}
            value={style.lineHeight}
            step={0.05}
            min={0.5}
            max={4}
            decimals={2}
            onCommit={(lineHeight) => override({ lineHeight })}
            onPreview={(lineHeight) =>
              onPreview(
                lineHeight === null ? null : { overrides: { lineHeight } },
              )
            }
          />
        </Row>
        <Row
          label={t("expert.text.color")}
          htmlFor={id("color")}
          reset={reset("color")}
        >
          <ColorField
            id={id("color")}
            value={style.color}
            palette={document.theme.palette}
            onChange={(color) => {
              if (color) override({ color });
            }}
          />
        </Row>
      </Section>

      <Section title={t("expert.text.layout")}>
        <Row label={t("expert.text.align")}>
          <IconChoice
            label={t("expert.text.align")}
            value={layer.align}
            onChange={(align) => set({ align })}
            options={[
              {
                value: "left",
                label: t("expert.text.alignLeft"),
                icon: <TextAlignStart />,
              },
              {
                value: "center",
                label: t("expert.text.alignCenter"),
                icon: <TextAlignCenter />,
              },
              {
                value: "right",
                label: t("expert.text.alignRight"),
                icon: <TextAlignEnd />,
              },
            ]}
          />
        </Row>
        <Row label={t("expert.text.valign")}>
          <IconChoice
            label={t("expert.text.valign")}
            value={layer.valign}
            onChange={(valign) => set({ valign })}
            options={[
              {
                value: "top",
                label: t("expert.text.valignTop"),
                icon: <AlignVerticalJustifyStart />,
              },
              {
                value: "middle",
                label: t("expert.text.valignMiddle"),
                icon: <AlignVerticalJustifyCenter />,
              },
              {
                value: "bottom",
                label: t("expert.text.valignBottom"),
                icon: <AlignVerticalJustifyEnd />,
              },
            ]}
          />
        </Row>
        <label className="flex items-center gap-2 text-[13px]">
          <input
            type="checkbox"
            checked={layer.fit === "shrink"}
            onChange={(event) =>
              set({ fit: event.target.checked ? "shrink" : "none" })
            }
            className="size-3.5 accent-[var(--color-primary)]"
          />
          {t("expert.text.shrink")}
        </label>
        {layer.fit === "shrink" ? (
          <Row
            label={t("expert.text.minSize")}
            htmlFor={id("min")}
            reset={
              layer.minSize === undefined ? null : (
                <ResetButton
                  label={t("expert.text.minSizeReset")}
                  onReset={() => {
                    const { minSize: _minSize, ...rest } = layer;
                    apply(replaceLayer(document, target, rest as TextLayer));
                  }}
                />
              )
            }
          >
            <NumberField
              id={id("min")}
              unit="pt"
              value={layer.minSize ?? Math.round(style.size * 2) / 4}
              step={0.5}
              min={1}
              max={style.size}
              onCommit={(minSize) => set({ minSize })}
            />
          </Row>
        ) : null}
      </Section>
    </>
  );
}

/** The words, with a menu that writes the couple's details in as tokens. */
function Words({
  layer,
  document,
  fields,
  onCommit,
  onPreview,
  focus,
}: {
  layer: TextLayer;
  document: DesignDocument;
  fields: Fields;
  onCommit: (text: string) => void;
  onPreview: (text: string | null) => void;
  focus: TextFocus | null;
}) {
  const t = useI18n();
  const locale = useCurrentLocale();
  const area = useRef<HTMLTextAreaElement>(null);
  const [draft, setDraft] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  /** Where a detail goes in: the cursor, as last seen in the field. */
  const caret = useRef<{ start: number; end: number } | null>(null);
  /** The cursor to restore once the menu has closed. */
  const restore = useRef<number | null>(null);

  const commit = (text: string | null) => {
    clearTimeout(timer.current);
    if (text !== null && text !== layer.text) onCommit(text);
    onPreview(null);
    setDraft(null);
  };
  // Words typed and not yet kept still count when the field goes away.
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

  useEffect(() => {
    if (!focus || focus.id !== layer.id) return;
    const element = area.current;
    if (!element) return;
    element.focus();
    if (focus.select) element.select();
    else element.setSelectionRange(element.value.length, element.value.length);
  }, [focus, layer.id]);

  const remember = () => {
    const element = area.current;
    if (element)
      caret.current = {
        start: element.selectionStart,
        end: element.selectionEnd,
      };
  };

  const insert = (token: string) => {
    const text = draft ?? layer.text;
    const { start, end } = caret.current ?? {
      start: text.length,
      end: text.length,
    };
    const next = text.slice(0, start) + token + text.slice(end);
    restore.current = start + token.length;
    caret.current = { start: start + token.length, end: start + token.length };
    commit(next);
  };

  const definitions = fieldsFor(document.occasion);
  const example = (key: string) =>
    fields[key]?.trim() || definitions[key]?.examples[document.language] || "";

  return (
    <div className="space-y-2">
      <textarea
        ref={area}
        aria-label={t("expert.text.words")}
        value={draft ?? layer.text}
        rows={Math.min(
          8,
          Math.max(3, (draft ?? layer.text).split("\n").length),
        )}
        maxLength={4000}
        spellCheck
        lang={document.language}
        onChange={(event) => {
          const text = event.target.value;
          setDraft(text);
          onPreview(text);
          remember();
          clearTimeout(timer.current);
          timer.current = setTimeout(
            () => pending.current.commit(text),
            COMMIT_DELAY_MS,
          );
        }}
        onSelect={remember}
        onBlur={() => {
          remember();
          if (draft !== null) commit(draft);
        }}
        onKeyDown={(event) => {
          if (event.key === "Escape") event.currentTarget.blur();
        }}
        className="block w-full resize-y rounded-lg border border-input bg-card px-2.5 py-2 text-[13px] leading-relaxed outline-none transition-[border-color,box-shadow] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/30"
      />
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="inline-flex h-7 items-center gap-1.5 rounded-full border border-input bg-card px-2.5 text-[12px] font-medium outline-none hover:bg-secondary focus-visible:ring-[3px] focus-visible:ring-ring/40"
          >
            <Braces className="size-3.5" aria-hidden />
            {t("expert.text.insert")}
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="start"
          className="max-h-80"
          onCloseAutoFocus={(event) => {
            const at = restore.current;
            if (at === null) return;
            // Back to the words, the cursor after the detail just written.
            event.preventDefault();
            restore.current = null;
            const element = area.current;
            element?.focus();
            element?.setSelectionRange(at, at);
          }}
        >
          {Object.entries(definitions).map(([key, definition]) =>
            definition.kind === "date" ? (
              <DropdownMenuSub key={key}>
                <DropdownMenuSubTrigger>
                  {definition.labels[locale]}
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent>
                  {dateFormats.map((format) => (
                    <DropdownMenuItem
                      key={format}
                      onSelect={() => insert(`{{${key}:${format}}}`)}
                    >
                      <span className="flex-1">
                        {t(`expert.dateFormat.${format}`)}
                      </span>
                      <span className="text-[11px] text-muted-foreground">
                        {formatDate(example(key), format, document.language)}
                      </span>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuSubContent>
              </DropdownMenuSub>
            ) : (
              <DropdownMenuItem key={key} onSelect={() => insert(`{{${key}}}`)}>
                {definition.labels[locale]}
              </DropdownMenuItem>
            ),
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

/** A word of warning when the words don't fit their frame. */
function Overflow({
  document,
  layer,
  fields,
}: {
  document: DesignDocument;
  layer: TextLayer;
  fields: Fields;
}) {
  const t = useI18n();
  const measure = useCanvasMeasure();
  const overflows = useMemo(() => {
    const text = resolveText(layer.text, {
      fields,
      occasion: document.occasion,
      language: document.language,
    });
    if (!text.trim()) return false;
    return layoutText({
      text,
      style: { ...document.theme.text[layer.style], ...layer.overrides },
      width: layer.frame.width,
      height: layer.frame.height,
      fit: layer.fit,
      minSize: layer.minSize,
      measure,
    }).overflows;
  }, [document, layer, fields, measure]);
  if (!overflows) return null;
  return (
    <p className="flex items-start gap-1.5 text-[12px] leading-snug text-destructive">
      <CircleAlert className="mt-px size-3.5 shrink-0" aria-hidden />
      {t("expert.text.overflow")}
    </p>
  );
}
