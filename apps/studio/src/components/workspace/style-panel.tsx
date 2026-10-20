"use client";

import {
  type Accessory,
  type DesignDocument,
  faceNames,
  foilShades,
  type Ink,
  inkLabels,
  type Operation,
  type PalettePreset,
  palettePresets,
  type StockId,
  stocks,
  type WaxColor,
  waxColors,
} from "@jolene/design";
import { cn } from "@jolene/ui/utils";
import { Check } from "lucide-react";
import type { ReactNode } from "react";
import { useCurrentLocale, useI18n } from "@/locales/client";

const nameInks = [
  "foil-gold",
  "foil-rose-gold",
  "foil-silver",
  "foil-copper",
  "print",
] as const satisfies readonly Ink[];

const cardStocks = [
  "cotton-350",
  "textured-300",
  "smooth-300",
  "pearl-250",
  "kraft-300",
] as const satisfies readonly StockId[];

/** Every layer that sets the couple's names, wherever it is. */
function nameLayers(document: DesignDocument) {
  return document.pieces.flatMap((piece) =>
    faceNames.flatMap((face) =>
      (piece[face]?.layers ?? [])
        .filter((layer) => layer.type === "text" && layer.style === "names")
        .map((layer) => ({ piece: piece.id, face, layer })),
    ),
  );
}

type WaxSeal = Extract<Accessory, { kind: "wax-seal" }>;

/**
 * Simple mode's choices: a palette, the finish of the names, the paper and
 * the wax. Each is one click, and each is an operation on the design.
 */
export function StylePanel({
  document,
  apply,
}: {
  document: DesignDocument;
  apply: (operations: Operation[]) => void;
}) {
  const t = useI18n();
  const locale = useCurrentLocale();
  const names = nameLayers(document);
  const namesInk = names[0]?.layer.ink;
  const card =
    document.pieces.find((piece) => piece.role === "card") ??
    document.pieces.find((piece) => piece.role !== "overlay");
  const seal = document.accessories.find(
    (accessory): accessory is WaxSeal => accessory.kind === "wax-seal",
  );
  const palette = document.theme.palette;

  return (
    <div className="space-y-8">
      <Section title={t("design.palette")}>
        <div className="grid grid-cols-2 gap-2.5">
          {Object.entries(palettePresets).map(([id, preset]) => (
            <PaletteSwatch
              key={id}
              preset={preset}
              label={preset.labels[locale]}
              active={samePalette(preset.palette, palette)}
              onSelect={() =>
                apply([
                  { op: "setPalette", palette: preset.palette },
                  ...(seal
                    ? [
                        {
                          op: "setAccessory" as const,
                          accessory: { ...seal, color: preset.wax },
                        },
                      ]
                    : []),
                ])
              }
            />
          ))}
        </div>
      </Section>

      {names.length > 0 ? (
        <Section title={t("design.namesInk")}>
          <div className="grid grid-cols-5 gap-x-1 gap-y-4">
            {nameInks.map((ink) => (
              <Choice
                key={ink}
                label={inkLabels[ink][locale]}
                active={namesInk === ink}
                onSelect={() =>
                  apply(
                    names.map(({ piece, face, layer }) => ({
                      op: "updateLayer",
                      piece,
                      face,
                      layer: layer.id,
                      set: { ink },
                    })),
                  )
                }
                swatch={
                  <span
                    className="size-full rounded-full"
                    style={{
                      background:
                        ink === "print"
                          ? palette.accent
                          : `linear-gradient(135deg, ${foilShades[ink][2]}, ${foilShades[ink][1]} 40%, ${foilShades[ink][2]} 60%, ${foilShades[ink][0]})`,
                    }}
                  />
                }
              />
            ))}
          </div>
        </Section>
      ) : null}

      {card ? (
        <Section title={t("design.paper")}>
          <div className="grid gap-2">
            {cardStocks.map((stock) => {
              const active = card.stock === stock;
              return (
                <button
                  key={stock}
                  type="button"
                  onClick={() =>
                    apply([
                      { op: "updatePiece", piece: card.id, set: { stock } },
                    ])
                  }
                  aria-pressed={active}
                  className={cn(
                    "flex items-center gap-3 rounded-xl border bg-card px-3 py-2.5 text-left text-sm outline-none transition focus-visible:ring-[3px] focus-visible:ring-ring/50",
                    active
                      ? "border-foreground/40 shadow-sm"
                      : "border-border hover:border-foreground/20",
                  )}
                >
                  <span
                    className="size-7 shrink-0 rounded-md border border-black/10 shadow-inner"
                    style={{ background: stocks[stock].color }}
                  />
                  <span className="flex-1">{stocks[stock].labels[locale]}</span>
                  {active ? <Check className="size-4" aria-hidden /> : null}
                </button>
              );
            })}
          </div>
        </Section>
      ) : null}

      {seal ? (
        <Section title={t("design.seal")}>
          <div className="grid grid-cols-5 gap-x-1 gap-y-4">
            {(Object.keys(waxColors) as WaxColor[]).map((color) => (
              <Choice
                key={color}
                label={waxColors[color].labels[locale]}
                active={seal.color === color}
                onSelect={() =>
                  apply([{ op: "setAccessory", accessory: { ...seal, color } }])
                }
                swatch={
                  <span
                    className="size-full rounded-full shadow-inner"
                    style={{
                      background: `radial-gradient(circle at 35% 30%, color-mix(in oklab, ${waxColors[color].color} 60%, white), ${waxColors[color].color} 55%, color-mix(in oklab, ${waxColors[color].color} 70%, black))`,
                    }}
                  />
                }
              />
            ))}
          </div>
        </Section>
      ) : null}
    </div>
  );
}

const samePalette = (a: PalettePreset["palette"], b: Record<string, string>) =>
  Object.entries(a).every(
    ([token, value]) => b[token]?.toLowerCase() === value.toLowerCase(),
  );

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h3 className="mb-3 text-[11px] font-medium uppercase tracking-[0.22em] text-muted-foreground">
        {title}
      </h3>
      {children}
    </section>
  );
}

/** A palette as a small card: the paper, the names in the accent, the art. */
function PaletteSwatch({
  preset,
  label,
  active,
  onSelect,
}: {
  preset: PalettePreset;
  label: string;
  active: boolean;
  onSelect: () => void;
}) {
  const { paper, accent, art, ink } = preset.palette;
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={active}
      className={cn(
        "group flex flex-col gap-2 rounded-2xl border bg-card p-2 text-left outline-none transition focus-visible:ring-[3px] focus-visible:ring-ring/50",
        active
          ? "border-foreground/40 shadow-sm"
          : "border-border hover:border-foreground/20",
      )}
    >
      <span
        className="relative flex h-14 items-center justify-center overflow-hidden rounded-xl border border-black/5"
        style={{ background: paper }}
      >
        <span
          className="font-display text-2xl italic"
          style={{ color: accent }}
        >
          A &amp; M
        </span>
        <span
          className="absolute bottom-2 left-1/2 h-px w-10 -translate-x-1/2"
          style={{ background: art }}
        />
        <span
          className="absolute right-2 top-2 size-2 rounded-full"
          style={{ background: ink }}
        />
      </span>
      <span className="flex items-center justify-between px-1 text-xs font-medium">
        {label}
        {active ? <Check className="size-3.5" aria-hidden /> : null}
      </span>
    </button>
  );
}

/** One round choice with its name under it: a foil, a paper, a wax. */
function Choice({
  label,
  active,
  onSelect,
  swatch,
}: {
  label: string;
  active: boolean;
  onSelect: () => void;
  swatch: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={active}
      title={label}
      className="group flex min-w-0 flex-col items-center gap-1.5 text-center outline-none"
    >
      <span
        className={cn(
          "flex size-11 rounded-full p-1 ring-1 transition group-focus-visible:ring-[3px] group-focus-visible:ring-ring/50",
          active
            ? "ring-2 ring-foreground/60"
            : "ring-border group-hover:ring-foreground/30",
        )}
      >
        {swatch}
      </span>
      <span className="text-[11px] leading-tight text-muted-foreground group-aria-pressed:text-foreground">
        {label}
      </span>
    </button>
  );
}
