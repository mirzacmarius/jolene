"use client";

import {
  type Alignment,
  alignPlacements,
  type DesignDocument,
  distributePlacements,
  type FaceRef,
  type Frame,
  type Layer,
  type Operation,
  restackLayers,
} from "@jolene/design";
import {
  AlignHorizontalDistributeCenter,
  AlignVerticalDistributeCenter,
} from "lucide-react";
import { useI18n } from "@/locales/client";
import { LayerActionButtons, layerActions } from "../layer-actions";
import { IconAction, Section } from "./fields";
import { AlignRow, ArrangeRow } from "./layer-section";

const round = (value: number) => Math.round(value * 100) / 100;

/**
 * Several layers at once: line them up with each other, space them evenly,
 * restack, copy or remove them. Locked layers stay where they are.
 */
export function SelectionSection({
  document,
  target,
  layers,
  apply,
  onSelect,
}: {
  document: DesignDocument;
  target: FaceRef;
  layers: readonly Layer[];
  apply: (operations: Operation[]) => void;
  onSelect: (ids: string[]) => void;
}) {
  const t = useI18n();
  const movable = layers.filter((layer) => !layer.locked);
  const moveTo = (frames: Frame[]): Operation[] =>
    movable.flatMap((layer, index) => {
      const frame = frames[index];
      if (!frame) return [];
      const x = round(frame.x);
      const y = round(frame.y);
      return x === layer.frame.x && y === layer.frame.y
        ? []
        : [
            {
              op: "updateLayer" as const,
              ...target,
              layer: layer.id,
              set: { frame: { x, y } },
            },
          ];
    });
  const align = (alignment: Alignment) =>
    apply(moveTo(alignPlacements(movable, alignment)));
  const distribute = (axis: "x" | "y") =>
    apply(moveTo(distributePlacements(movable, axis)));
  const ids = layers.map((layer) => layer.id);

  return (
    <>
      <Section
        title={t("expert.selection.title", { count: layers.length })}
        action={
          <LayerActionButtons
            actions={layerActions({ document, target, ids, apply, onSelect })}
            className="-my-1 -mr-1.5"
          />
        }
      >
        <p className="text-[12px] text-muted-foreground">
          {t("expert.selection.lead")}
        </p>
        <AlignRow onAlign={align} />
        <div className="flex gap-0.5 rounded-lg bg-secondary/60 p-0.5">
          <IconAction
            label={t("expert.selection.distributeX")}
            disabled={movable.length < 3}
            onClick={() => distribute("x")}
          >
            <AlignHorizontalDistributeCenter />
          </IconAction>
          <IconAction
            label={t("expert.selection.distributeY")}
            disabled={movable.length < 3}
            onClick={() => distribute("y")}
          >
            <AlignVerticalDistributeCenter />
          </IconAction>
        </div>
      </Section>
      <Section title={t("expert.layer.arrange")}>
        <ArrangeRow
          onRestack={(how) => apply(restackLayers(document, target, ids, how))}
        />
      </Section>
    </>
  );
}
