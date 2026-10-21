"use client";

import { ChevronDownIcon } from "lucide-react";
import { createContext, type ReactNode, useContext, useId, useState } from "react";

import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  canSkipChoice,
  findExtrasVariant,
  fromBani,
  getDefaultAnswers,
  getExtrasPerItem,
  getLineAttributes,
  getMissingOptions,
  toBani,
} from "@/lib/line-options";
import type {
  CartAttribute,
  LineOption,
  LineOptionAnswers,
  ProductLineOptions,
} from "@/lib/line-options/types";
import { formatPrice } from "@/lib/money";

interface LineOptionsState {
  answers: LineOptionAnswers;
  chosenFees: string[];
  currencyCode: string;
  lineOptions: ProductLineOptions;
  setAnswer: (key: string, value: string) => void;
  setFee: (id: string, chosen: boolean) => void;
}

const LineOptionsContext = createContext<LineOptionsState | null>(null);

interface LineOptionsProviderProps {
  children: ReactNode;
  currencyCode: string;
  lineOptions: ProductLineOptions;
}

export function LineOptionsProvider({
  children,
  currencyCode,
  lineOptions,
}: LineOptionsProviderProps) {
  const [answers, setAnswers] = useState(() => getDefaultAnswers(lineOptions.options));
  const [chosenFees, setChosenFees] = useState<string[]>([]);
  return (
    <LineOptionsContext.Provider
      value={{
        answers,
        chosenFees,
        currencyCode,
        lineOptions,
        setAnswer: (key, value) => setAnswers((current) => ({ ...current, [key]: value })),
        setFee: (id, chosen) =>
          setChosenFees((current) => [
            ...current.filter((fee) => fee !== id),
            ...(chosen ? [id] : []),
          ]),
      }}
    >
      {children}
    </LineOptionsContext.Provider>
  );
}

function useLineOptions() {
  const context = useContext(LineOptionsContext);
  if (!context) throw new Error("useLineOptions must be used within LineOptionsProvider");
  return context;
}

export function useLineOptionsOrder() {
  const { answers, chosenFees, lineOptions } = useLineOptions();
  const { minQuantity, options } = lineOptions;
  const bani = getExtrasPerItem(options, answers);
  const extras = bani ? findExtrasVariant(lineOptions.extras, bani) : undefined;
  const fees = lineOptions.fees.filter((fee) => chosenFees.includes(fee.id));
  return {
    getAttributes: (merchandiseId: string, attributes?: CartAttribute[]) =>
      getLineAttributes({ answers, attributes, extras, fees, merchandiseId, options }),
    hasLineOptions: options.length > 0 || lineOptions.fees.length > 0,
    minQuantity,
    missing: getMissingOptions(options, answers),
    unavailable: bani > 0 && !extras,
  };
}

interface LineOptionsFieldsProps {
  disabled?: boolean;
}

export function LineOptionsFields({ disabled = false }: LineOptionsFieldsProps) {
  const { answers, chosenFees, currencyCode, lineOptions, setAnswer, setFee } = useLineOptions();
  const id = useId();
  const { fees, options } = lineOptions;
  if (!options.length && !fees.length) return null;
  const extras = getExtrasPerItem(options, answers);

  return (
    <fieldset className="grid min-w-0 gap-5" disabled={disabled}>
      <legend className="sr-only">Opțiuni de comandă</legend>
      {options.map((option, index) => (
        <LineOptionField
          answer={answers[option.key] ?? ""}
          currencyCode={currencyCode}
          id={`${id}-${index}`}
          key={option.key}
          onAnswer={(value) => setAnswer(option.key, value)}
          option={option}
        />
      ))}
      {fees.map((fee) => (
        <label
          className="flex cursor-pointer items-start gap-2.5 rounded-lg border border-border p-4 has-checked:border-foreground has-disabled:cursor-not-allowed has-disabled:opacity-50"
          key={fee.id}
        >
          <input
            checked={chosenFees.includes(fee.id)}
            className="mt-0.5 size-4 shrink-0 cursor-pointer accent-foreground disabled:cursor-not-allowed"
            onChange={(event) => setFee(fee.id, event.target.checked)}
            type="checkbox"
          />
          <span className="grid flex-1 gap-1 text-sm">
            <span className="flex flex-wrap items-center justify-between gap-2.5">
              <span>{fee.title}</span>
              <span className="tabular-nums">+{formatPrice(fee.price)} pe comandă</span>
            </span>
            {fee.description ? (
              <span className="text-muted-foreground">{fee.description}</span>
            ) : null}
          </span>
        </label>
      ))}
      {extras > 0 ? (
        <p className="text-sm text-muted-foreground" role="status">
          Opțiunile alese adaugă {formatPrice({ amount: fromBani(extras), currencyCode })} la
          fiecare bucată.
        </p>
      ) : null}
    </fieldset>
  );
}

interface LineOptionFieldProps {
  answer: string;
  currencyCode: string;
  id: string;
  onAnswer: (value: string) => void;
  option: LineOption;
}

function LineOptionField({ answer, currencyCode, id, onAnswer, option }: LineOptionFieldProps) {
  const hintId = option.hint ? `${id}-hint` : undefined;
  const control = {
    "aria-describedby": hintId,
    "aria-required": option.required,
    id,
    value: answer,
  };
  return (
    <div className="grid gap-2.5">
      <label className="text-sm font-medium text-foreground/70" htmlFor={id}>
        {option.label}
      </label>
      {option.kind === "select" ? (
        <div className="relative">
          <select
            {...control}
            className="h-9 w-full cursor-pointer appearance-none rounded-md border border-input bg-transparent py-1 pr-8 pl-2.5 text-base shadow-xs outline-none transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm"
            onChange={(event) => onAnswer(event.target.value)}
          >
            {option.required ? (
              <option disabled value="">
                Alege
              </option>
            ) : canSkipChoice(option) ? (
              <option value="">Nu doresc</option>
            ) : null}
            {option.choices.map((choice) => (
              <option key={choice.label} value={choice.label}>
                {toBani(choice.price)
                  ? `${choice.label} · +${formatPrice({ amount: choice.price, currencyCode })}/buc.`
                  : choice.label}
              </option>
            ))}
          </select>
          <ChevronDownIcon
            aria-hidden="true"
            className="pointer-events-none absolute top-1/2 right-2.5 size-4 -translate-y-1/2 opacity-50"
          />
        </div>
      ) : option.kind === "textarea" ? (
        <Textarea {...control} onChange={(event) => onAnswer(event.target.value)} rows={4} />
      ) : (
        <Input
          {...control}
          autoComplete={option.kind === "email" ? "email" : "off"}
          onChange={(event) => onAnswer(event.target.value)}
          type={option.kind === "email" ? "email" : "text"}
        />
      )}
      {option.hint ? (
        <p className="text-xs text-muted-foreground" id={hintId}>
          {option.hint}
        </p>
      ) : null}
    </div>
  );
}
