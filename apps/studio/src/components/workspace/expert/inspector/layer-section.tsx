"use client";

import {
  type Alignment,
  alignPlacements,
  type DesignDocument,
  type FaceRef,
  type Ink,
  inkLabels,
  inks,
  type Layer,
  type LayerChanges,
  MIN_LAYER_SIZE,
  normalizeRotation,
  type Operation,
  type Piece,
  type Restack,
  restackLayers,
} from "@jolene/design";
import {
  AlignCenterHorizontal,
  AlignCenterVertical,
  AlignEndHorizontal,
  AlignEndVertical,
  AlignStartHorizontal,
  AlignStartVertical,
  ArrowDown,
  ArrowDownToLine,
  ArrowUp,
  ArrowUpToLine,
  Eye,
  EyeOff,
  Lock,
  LockOpen,
} from "lucide-react";
import type { ReactNode } from "react";
import { useCurrentLocale, useI18n } from "@/locales/client";
import {
  IconAction,
  IconToggle,
  NumberField,
  Row,
  Section,
  Select,
} from "./fields";

export const alignIcons: Record<Alignment, ReactNode> = {
  left: <AlignStartVertical />,
  center: <AlignCenterVertical />,
  right: <AlignEndVertical />,
  top: <AlignStartHorizontal />,
  middle: <AlignCenterHorizontal />,
  bottom: <AlignEndHorizontal />,
};

export const restackIcons: Record<Restack, ReactNode> = {
  front: <ArrowUpToLine />,
  forward: <ArrowUp />,
  backward: <ArrowDown />,
  back: <ArrowDownToLine />,
};

/** Bringing forward or sending back, as one row of buttons. */
export function ArrangeRow({
  onRestack,
  disabled,
}: {
  onRestack: (how: Restack) => void;
  disabled?: Partial<Record<Restack, boolean>>;
}) {
  const t = useI18n();
  return (
    <div className="flex gap-0.5 rounded-lg bg-secondary/60 p-0.5">
      {(["front", "forward", "backward", "back"] as const).map((how) => (
        <IconAction
          key={how}
          label={t(`expert.arrange.${how}`)}
          onClick={() => onRestack(how)}
          disabled={disabled?.[how]}
        >
          {restackIcons[how]}
        </IconAction>
      ))}
    </div>
  );
}

/** Six buttons that line layers up on a side or a middle. */
export function AlignRow({
  onAlign,
}: {
  onAlign: (alignment: Alignment) => void;
}) {
  const t = useI18n();
  return (
    <div className="flex gap-0.5 rounded-lg bg-secondary/60 p-0.5">
      {(["left", "center", "right", "top", "middle", "bottom"] as const).map(
        (alignment) => (
          <IconAction
            key={alignment}
            label={t(`expert.align.${alignment}`)}
            onClick={() => onAlign(alignment)}
          >
            {alignIcons[alignment]}
          </IconAction>
        ),
      )}
    </div>
  );
}

/**
 * What every layer has: its place and size on the face, its turn, how see-
 * through it is, its ink, its place in the stack, its lock and visibility.
 */
export function LayerSection({
  document,
  piece,
  target,
  layer,
  apply,
  onPreview,
}: {
  document: DesignDocument;
  piece: Piece;
  target: FaceRef;
  layer: Layer;
  apply: (operations: Operation[]) => void;
  onPreview: (changes: LayerChanges | null) => void;
}) {
  const t = useI18n();
  const locale = useCurrentLocale();
  const set = (changes: LayerChanges) =>
    apply([{ op: "updateLayer", ...target, layer: layer.id, set: changes }]);
  const { frame } = layer;
  const stack = piece[target.face]?.layers ?? [];
  const index = stack.findIndex((candidate) => candidate.id === layer.id);
  const frameField = (
    key: "x" | "y" | "width" | "height",
    label: string,
    name: string,
  ) => (
    <NumberField
      label={label}
      name={name}
      unit="mm"
      value={frame[key]}
      step={key === "x" || key === "y" ? 0.5 : 1}
      decimals={2}
      min={key === "width" || key === "height" ? MIN_LAYER_SIZE : undefined}
      onCommit={(value) => set({ frame: { [key]: value } })}
      onPreview={(value) =>
        onPreview(value === null ? null : { frame: { [key]: value } })
      }
    />
  );
  const align = (alignment: Alignment) => {
    const [aligned] = alignPlacements([layer], alignment, {
      x: 0,
      y: 0,
      width: piece.width,
      height: piece.height,
    });
    if (aligned && (aligned.x !== frame.x || aligned.y !== frame.y))
      set({
        frame: {
          x: Math.round(aligned.x * 100) / 100,
          y: Math.round(aligned.y * 100) / 100,
        },
      });
  };
  const restack = (how: Restack) =>
    apply(restackLayers(document, target, [layer.id], how));

  return (
    <>
      <Section title={t("expert.layer.place")}>
        <div className="grid grid-cols-2 gap-1.5">
          {frameField("x", "X", t("expert.layer.x"))}
          {frameField("y", "Y", t("expert.layer.y"))}
          {frameField(
            "width",
            t("expert.layer.widthShort"),
            t("expert.layer.width"),
          )}
          {frameField(
            "height",
            t("expert.layer.heightShort"),
            t("expert.layer.height"),
          )}
          <NumberField
            label="↻"
            name={t("expert.layer.rotation")}
            unit="°"
            value={layer.rotation}
            min={-360}
            max={360}
            decimals={1}
            onCommit={(value) => set({ rotation: normalizeRotation(value) })}
            onPreview={(value) =>
              onPreview(value === null ? null : { rotation: value })
            }
          />
          <NumberField
            label="◐"
            name={t("expert.layer.opacity")}
            unit="%"
            value={Math.round(layer.opacity * 100)}
            min={0}
            max={100}
            step={5}
            decimals={0}
            onCommit={(value) => set({ opacity: value / 100 })}
            onPreview={(value) =>
              onPreview(value === null ? null : { opacity: value / 100 })
            }
          />
        </div>
        <div>
          <p className="mb-1.5 text-[12px] text-muted-foreground">
            {t("expert.layer.alignOnFace")}
          </p>
          <AlignRow onAlign={align} />
        </div>
      </Section>

      <Section title={t("expert.layer.printing")}>
        <Row label={t("expert.layer.ink")} htmlFor={`ink-${layer.id}`}>
          <Select
            id={`ink-${layer.id}`}
            value={layer.ink}
            options={inks.map((ink: Ink) => ({
              value: ink,
              label: inkLabels[ink][locale],
            }))}
            onChange={(ink) => set({ ink })}
          />
        </Row>
      </Section>

      <Section title={t("expert.layer.arrange")}>
        <ArrangeRow
          onRestack={restack}
          disabled={{
            front: index === stack.length - 1,
            forward: index === stack.length - 1,
            backward: index === 0,
            back: index === 0,
          }}
        />
        <div className="flex gap-1.5">
          <IconToggle
            pressed={layer.locked}
            onChange={(locked) => set({ locked })}
            label={
              layer.locked ? t("expert.layers.unlock") : t("expert.layers.lock")
            }
          >
            {layer.locked ? <Lock /> : <LockOpen />}
          </IconToggle>
          <IconToggle
            pressed={layer.hidden}
            onChange={(hidden) => set({ hidden })}
            label={
              layer.hidden ? t("expert.layers.show") : t("expert.layers.hide")
            }
          >
            {layer.hidden ? <EyeOff /> : <Eye />}
          </IconToggle>
        </div>
      </Section>
    </>
  );
}
