"use client";

import type {
  DesignDocument,
  FaceRef,
  ImageLayer,
  LayerChanges,
  Operation,
} from "@jolene/design";
import type { AssetResolver } from "@jolene/design/react";
import { cn } from "@jolene/ui/utils";
import { FlipHorizontal2, FlipVertical2 } from "lucide-react";
import { useI18n } from "@/locales/client";
import type { Artwork } from "../add-menu";
import { ColorField, IconToggle, Row, Section, Select } from "./fields";

/**
 * A picture: another of the collection's artwork in its place, its colour
 * when it is line art that takes one, its flips and how it fills its frame.
 */
export function ImageSection({
  document,
  target,
  layer,
  artwork,
  resolve,
  apply,
}: {
  document: DesignDocument;
  target: FaceRef;
  layer: ImageLayer;
  artwork: readonly Artwork[] | undefined;
  resolve: AssetResolver;
  apply: (operations: Operation[]) => void;
}) {
  const t = useI18n();
  const set = (changes: LayerChanges) =>
    apply([{ op: "updateLayer", ...target, layer: layer.id, set: changes }]);
  const recolorable = layer.asset
    ? (resolve(layer.asset)?.recolorable ?? false)
    : false;
  const id = (name: string) => `${name}-${layer.id}`;

  return (
    <Section title={t("expert.image.title")}>
      {layer.replaceable ? (
        <p className="text-[12px] leading-relaxed text-muted-foreground">
          {t("expert.image.photo")}
        </p>
      ) : (
        <div>
          <p className="mb-1.5 text-[12px] text-muted-foreground">
            {t("expert.image.swap")}
          </p>
          {artwork === undefined ? (
            <p className="text-[12px] text-muted-foreground">
              {t("expert.loading")}
            </p>
          ) : (
            <div className="grid max-h-56 grid-cols-4 gap-1.5 overflow-y-auto rounded-lg bg-secondary/50 p-1.5">
              {artwork.map((art) => (
                <button
                  key={art.key}
                  type="button"
                  aria-pressed={layer.asset === art.key}
                  title={art.name ?? art.key}
                  aria-label={art.name ?? art.key}
                  onClick={() => {
                    if (art.key !== layer.asset) set({ asset: art.key });
                  }}
                  className={cn(
                    "flex aspect-square items-center justify-center rounded-md border bg-card p-1 outline-none transition focus-visible:ring-2 focus-visible:ring-ring/50",
                    layer.asset === art.key
                      ? "border-foreground/50 shadow-sm"
                      : "border-transparent hover:border-foreground/20",
                  )}
                >
                  <img
                    src={art.url}
                    alt=""
                    loading="lazy"
                    className="size-full object-contain"
                  />
                </button>
              ))}
            </div>
          )}
        </div>
      )}
      {recolorable ? (
        <Row label={t("expert.image.tint")} htmlFor={id("tint")}>
          <ColorField
            id={id("tint")}
            value={layer.tint ?? null}
            palette={document.theme.palette}
            noneLabel={t("expert.image.original")}
            onChange={(tint) => set({ tint })}
          />
        </Row>
      ) : null}
      <Row label={t("expert.image.fit")} htmlFor={id("fit")}>
        <Select
          id={id("fit")}
          value={layer.fit}
          options={[
            { value: "contain", label: t("expert.image.contain") },
            { value: "cover", label: t("expert.image.cover") },
            { value: "fill", label: t("expert.image.fill") },
          ]}
          onChange={(fit) => set({ fit })}
        />
      </Row>
      <Row label={t("expert.image.flip")}>
        <IconToggle
          pressed={layer.flipX}
          onChange={(flipX) => set({ flipX })}
          label={t("expert.image.flipX")}
        >
          <FlipHorizontal2 />
        </IconToggle>
        <IconToggle
          pressed={layer.flipY}
          onChange={(flipY) => set({ flipY })}
          label={t("expert.image.flipY")}
        >
          <FlipVertical2 />
        </IconToggle>
      </Row>
    </Section>
  );
}
