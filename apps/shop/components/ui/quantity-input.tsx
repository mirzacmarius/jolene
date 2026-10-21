"use client";

import { cn } from "cn";
import { MinusIcon, PlusIcon } from "lucide-react";
import { useState } from "react";

interface QuantityInputProps {
  className?: string;
  disabled?: boolean;
  max: number;
  min: number;
  onChange: (quantity: number) => void;
  size?: "default" | "sm";
  value: number;
}

// A typed quantity counts once the field loses focus or Enter is pressed, so 120 isn't sent as 1, then 12.
export function QuantityInput({
  className,
  disabled = false,
  max,
  min,
  onChange,
  size = "default",
  value,
}: QuantityInputProps) {
  const [draft, setDraft] = useState<string>();
  const small = size === "sm";

  function commit() {
    if (draft === undefined) return;
    setDraft(undefined);
    const typed = Number.parseInt(draft, 10);
    if (Number.isNaN(typed)) return;
    const quantity = Math.min(Math.max(typed, min), max);
    if (quantity !== value) onChange(quantity);
  }

  return (
    <div
      aria-label="Cantitate"
      className={cn(
        "grid shrink-0 bg-background ring-1 ring-border ring-inset",
        small
          ? "h-6 grid-cols-[1.75rem_2.5rem_1.75rem] rounded-full"
          : "h-12 grid-cols-[3rem_3.5rem_3rem] rounded-lg",
        className,
      )}
      role="group"
    >
      <button
        aria-label="Scade cantitatea"
        className="flex cursor-pointer items-center justify-center disabled:cursor-not-allowed disabled:opacity-50"
        disabled={disabled || value <= min}
        onClick={() => onChange(value - 1)}
        type="button"
      >
        <MinusIcon className={small ? "size-3" : "size-4"} />
      </button>
      <input
        aria-label="Cantitate"
        className={cn(
          "w-full bg-transparent text-center font-medium tabular-nums outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed",
          small ? "rounded-full text-xs" : "rounded-lg text-sm",
        )}
        disabled={disabled}
        inputMode="numeric"
        onBlur={commit}
        onChange={(event) => setDraft(event.target.value.replace(/\D/g, ""))}
        onKeyDown={(event) => {
          if (event.key !== "Enter") return;
          event.preventDefault();
          commit();
        }}
        value={draft ?? String(value)}
      />
      <button
        aria-label="Crește cantitatea"
        className="flex cursor-pointer items-center justify-center disabled:cursor-not-allowed disabled:opacity-50"
        disabled={disabled || value >= max}
        onClick={() => onChange(value + 1)}
        type="button"
      >
        <PlusIcon className={small ? "size-3" : "size-4"} />
      </button>
    </div>
  );
}
