"use client";

import {
  type FontCategory,
  type FontFamilyName,
  fontCategories,
  fontFamilies,
} from "@jolene/design";
import { fontStack } from "@jolene/design/react";
import { Popover, PopoverContent, PopoverTrigger } from "@jolene/ui/popover";
import { cn } from "@jolene/ui/utils";
import { Check, ChevronDown } from "lucide-react";
import { type KeyboardEvent, useRef, useState } from "react";
import { useI18n } from "@/locales/client";
import { controlClass } from "./fields";

const byCategory = Object.fromEntries(
  fontCategories.map((category) => [
    category,
    (Object.keys(fontFamilies) as FontFamilyName[]).filter(
      (family) => fontFamilies[family].category === category,
    ),
  ]),
) as Record<FontCategory, FontFamilyName[]>;

/** Moves focus up and down the list of faces with the arrow keys. */
function onFontKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
  if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
  const list = event.currentTarget.closest("[data-fonts]");
  if (!list) return;
  const buttons = [...list.querySelectorAll<HTMLButtonElement>("[data-font]")];
  const at = buttons.indexOf(event.currentTarget);
  const next =
    buttons[
      event.key === "ArrowDown"
        ? Math.min(buttons.length - 1, at + 1)
        : Math.max(0, at - 1)
    ];
  if (next) {
    event.preventDefault();
    next.focus();
  }
}

/**
 * The typefaces, script first, then serif and sans, each name written in its
 * own face, so choosing one is seeing it.
 */
export function FontPicker({
  value,
  onChange,
  id,
}: {
  value: FontFamilyName;
  onChange: (family: FontFamilyName) => void;
  id?: string;
}) {
  const t = useI18n();
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState("");
  const list = useRef<HTMLDivElement>(null);
  const query = filter.trim().toLowerCase();
  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setFilter("");
      }}
    >
      <PopoverTrigger asChild>
        <button
          id={id}
          type="button"
          className={cn(
            controlClass,
            "flex items-center justify-between gap-2 text-left hover:border-foreground/25",
          )}
        >
          <span
            className="truncate text-[15px] leading-none"
            style={{ fontFamily: fontStack(value) }}
          >
            {value}
          </span>
          <ChevronDown
            className="size-3.5 shrink-0 text-muted-foreground"
            aria-hidden
          />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className="flex max-h-[min(30rem,var(--radix-popover-content-available-height))] w-72 flex-col p-0"
        onOpenAutoFocus={(event) => {
          // The chosen face, in view and ready for the arrow keys.
          event.preventDefault();
          const chosen = list.current?.querySelector<HTMLElement>(
            '[aria-pressed="true"]',
          );
          chosen?.focus({ preventScroll: true });
          // The popover settles its height a frame after it opens.
          requestAnimationFrame(() =>
            chosen?.scrollIntoView({ block: "center" }),
          );
        }}
      >
        <div className="border-b border-border p-2">
          <input
            type="search"
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
            placeholder={t("expert.font.search")}
            aria-label={t("expert.font.search")}
            className={cn(controlClass, "h-8")}
          />
        </div>
        <div
          ref={list}
          data-fonts
          className="min-h-0 flex-1 overflow-y-auto p-1.5"
        >
          {fontCategories.map((category) => {
            const families = byCategory[category].filter((family) =>
              family.toLowerCase().includes(query),
            );
            if (families.length === 0) return null;
            return (
              <div key={category} className="pb-1.5">
                <p className="px-2 pt-2 pb-1 text-[10px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
                  {t(`expert.font.${category}`)}
                </p>
                {families.map((family) => (
                  <button
                    key={family}
                    type="button"
                    data-font={family}
                    aria-pressed={family === value}
                    onKeyDown={onFontKeyDown}
                    onClick={() => {
                      onChange(family);
                      setOpen(false);
                    }}
                    className="flex w-full items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-left outline-none hover:bg-secondary focus-visible:bg-secondary focus-visible:ring-2 focus-visible:ring-ring/40 aria-pressed:bg-accent"
                  >
                    <span
                      className={cn(
                        "truncate leading-tight",
                        category === "script" ? "text-[21px]" : "text-[17px]",
                      )}
                      style={{ fontFamily: fontStack(family) }}
                    >
                      {family}
                    </span>
                    {family === value ? (
                      <Check className="size-4 shrink-0" aria-hidden />
                    ) : null}
                  </button>
                ))}
              </div>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}
