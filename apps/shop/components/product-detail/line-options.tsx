import { ChevronDownIcon } from "lucide-react";
import { useId } from "react";

import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { canSkipChoice, getExtrasPerItem } from "@/lib/line-options";
import type { Fee, LineOption, LineOptionAnswers } from "@/lib/line-options/types";
import { formatPrice } from "@/lib/money";

interface LineOptionsFieldsProps {
  answers: LineOptionAnswers;
  chosenFees: string[];
  fees: Fee[];
  onAnswer: (key: string, value: string) => void;
  onFee: (key: string, chosen: boolean) => void;
  options: LineOption[];
}

export function LineOptionsFields({
  answers,
  chosenFees,
  fees,
  onAnswer,
  onFee,
  options,
}: LineOptionsFieldsProps) {
  const id = useId();
  if (!options.length && !fees.length) return null;
  const extras = getExtrasPerItem(options, answers);

  return (
    <div className="grid min-w-0 gap-5" role="group" aria-label="Opțiuni de comandă">
      {options.map((option, index) => (
        <LineOptionField
          answer={answers[option.key] ?? ""}
          id={`${id}-${index}`}
          key={option.key}
          onAnswer={(value) => onAnswer(option.key, value)}
          option={option}
        />
      ))}
      {fees.map((fee) => (
        <label
          className="flex cursor-pointer items-start gap-2.5 rounded-lg border border-border p-4 has-checked:border-foreground has-disabled:cursor-not-allowed has-disabled:opacity-50"
          key={fee.key}
        >
          <input
            checked={chosenFees.includes(fee.key)}
            className="mt-0.5 size-4 shrink-0 cursor-pointer accent-foreground disabled:cursor-not-allowed"
            onChange={(event) => onFee(fee.key, event.target.checked)}
            type="checkbox"
          />
          <span className="grid flex-1 gap-1 text-sm">
            <span className="flex flex-wrap items-center justify-between gap-2.5">
              <span>{fee.label}</span>
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
          Opțiunile alese adaugă {formatPrice(extras)} la fiecare bucată.
        </p>
      ) : null}
    </div>
  );
}

interface LineOptionFieldProps {
  answer: string;
  id: string;
  onAnswer: (value: string) => void;
  option: LineOption;
}

function LineOptionField({ answer, id, onAnswer, option }: LineOptionFieldProps) {
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
                {choice.price
                  ? `${choice.label} · +${formatPrice(choice.price)} / buc.`
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
