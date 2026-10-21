import { cn } from "cn";

import { formatPrice } from "@/lib/money";
import type { ProductOption } from "@/lib/product/types";

interface OptionPickerProps {
  onSelect: (value: string) => void;
  option: ProductOption;
  selected: string | undefined;
}

export function OptionPicker({ onSelect, option, selected }: OptionPickerProps) {
  if (option.values.length === 1)
    return (
      <p className="text-sm font-medium text-foreground/70">
        {option.name}: <span className="text-foreground">{option.values[0]?.name}</span>
      </p>
    );
  return (
    <div className="grid gap-2.5" role="group" aria-label={option.name}>
      <p className="text-sm font-medium text-foreground/70">{option.name}</p>
      <div className="flex flex-wrap gap-2">
        {option.values.map((value) => {
          const isSelected = value.name === selected;
          return (
            <button
              aria-pressed={isSelected}
              className={cn(
                "grid cursor-pointer rounded-lg border px-5 py-2 text-center text-sm transition-all disabled:cursor-not-allowed disabled:opacity-50",
                isSelected
                  ? "border-foreground font-medium text-foreground"
                  : "border-border text-muted-foreground hover:border-foreground hover:text-foreground",
              )}
              key={value.name}
              onClick={() => onSelect(value.name)}
              type="button"
            >
              {value.name}
              {value.surcharge ? (
                <span className="text-xs font-normal text-muted-foreground tabular-nums">
                  +{formatPrice(value.surcharge)} / buc.
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}
