"use client";

import {
  type FieldDefinition,
  fieldLengths,
  fieldsFor,
  type Language,
  type Occasion,
} from "@jolene/design";
import { Input } from "@jolene/ui/input";
import { Label } from "@jolene/ui/label";
import { Textarea } from "@jolene/ui/textarea";
import { ChevronDown } from "lucide-react";
import { useCurrentLocale, useI18n } from "@/locales/client";

/**
 * The couple's details: first the ones this design prints, then the rest of
 * the occasion's, folded away, for the other pieces of the collection.
 */
export function FieldsPanel({
  occasion,
  used,
  language,
  values,
  onChange,
}: {
  occasion: Occasion;
  /** The fields the design reads, in order. */
  used: string[];
  /** The design's language, which the examples are written in. */
  language: Language;
  values: Record<string, string>;
  onChange: (key: string, value: string) => void;
}) {
  const t = useI18n();
  const definitions = fieldsFor(occasion);
  const others = Object.keys(definitions).filter(
    (key) => !used.includes(key) && key !== "monogram",
  );
  const field = (key: string) => {
    const definition = definitions[key];
    return definition ? (
      <Field
        key={key}
        id={key}
        definition={definition}
        language={language}
        value={values[key] ?? ""}
        onChange={(value) => onChange(key, value)}
      />
    ) : null;
  };
  return (
    <div className="space-y-6">
      <p className="text-sm leading-relaxed text-muted-foreground">
        {t("design.detailsLead")}
      </p>
      <div className="space-y-4">{used.map(field)}</div>
      {others.length > 0 ? (
        <details className="group rounded-2xl border border-border/80 bg-background/60">
          <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 text-sm font-medium">
            {t("design.moreDetails")}
            <ChevronDown
              className="size-4 text-muted-foreground transition-transform group-open:rotate-180"
              aria-hidden
            />
          </summary>
          <div className="space-y-4 px-4 pb-4">{others.map(field)}</div>
        </details>
      ) : null}
    </div>
  );
}

/** One detail's input, with its label and an example in the design's language. */
export function Field({
  id,
  definition,
  language,
  value,
  onChange,
}: {
  id: string;
  definition: FieldDefinition;
  language: Language;
  value: string;
  onChange: (value: string) => void;
}) {
  const t = useI18n();
  const locale = useCurrentLocale();
  const inputId = `field-${id}`;
  const example = definition.examples[language];
  const common = {
    id: inputId,
    value,
    maxLength: fieldLengths[definition.kind],
    onChange: (
      event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
    ) => onChange(event.target.value),
  };
  return (
    <div className="space-y-1.5">
      <Label htmlFor={inputId}>{definition.labels[locale]}</Label>
      {definition.kind === "multiline" ? (
        <Textarea
          {...common}
          rows={4}
          placeholder={t("design.example", { example })}
        />
      ) : definition.kind === "date" || definition.kind === "time" ? (
        <Input {...common} type={definition.kind} />
      ) : (
        <Input
          {...common}
          type="text"
          autoComplete="off"
          placeholder={t("design.example", { example })}
        />
      )}
    </div>
  );
}
