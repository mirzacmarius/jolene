"use client";

import type {
  ColorRef,
  DesignDocument,
  FaceRef,
  LayerChanges,
  Operation,
  ShapeLayer,
} from "@jolene/design";
import { useI18n } from "@/locales/client";
import { ColorField, NumberField, Row, Section, Select } from "./fields";

type Stroke = NonNullable<ShapeLayer["stroke"]>;
type Dash = "solid" | "dashed" | "dotted" | "custom";

/** Dashes and gaps, in millimetres. */
const dashes = { dashed: [2, 1.2], dotted: [0.4, 0.6] } as const;

function dashOf(stroke: Stroke | null): Dash {
  const dash = stroke?.dash;
  if (!dash || dash.length === 0) return "solid";
  for (const [name, pattern] of Object.entries(dashes))
    if (
      dash.length === pattern.length &&
      dash.every((value, index) => value === pattern[index])
    )
      return name as Dash;
  return "custom";
}

/**
 * A rectangle, ellipse, line or drawn shape: its fill, its outline and, for
 * a rectangle, its corners. A line is all outline.
 */
export function ShapeSection({
  document,
  target,
  layer,
  apply,
  onPreview,
}: {
  document: DesignDocument;
  target: FaceRef;
  layer: ShapeLayer;
  apply: (operations: Operation[]) => void;
  onPreview: (changes: LayerChanges | null) => void;
}) {
  const t = useI18n();
  const set = (changes: LayerChanges) =>
    apply([{ op: "updateLayer", ...target, layer: layer.id, set: changes }]);
  const line = layer.shape === "line";
  // A line without a stroke is drawn in its fill, as thick as its frame.
  const stroke: Stroke | null =
    layer.stroke ??
    (line && layer.fill
      ? { color: layer.fill, width: layer.frame.height }
      : null);
  const withStroke = (changes: Partial<Stroke>): Stroke => {
    const { dash: _dash, ...base } = stroke ?? {
      color: "$ink" as ColorRef,
      width: 0.3,
    };
    const next = { ...base, ...changes };
    const dash = "dash" in changes ? changes.dash : stroke?.dash;
    return dash && dash.length > 0 ? { ...next, dash: [...dash] } : next;
  };
  const id = (name: string) => `${name}-${layer.id}`;
  const pattern = dashOf(stroke);

  return (
    <Section title={t(`expert.kind.${layer.shape}`)}>
      {line ? null : (
        <Row label={t("expert.shape.fill")} htmlFor={id("fill")}>
          <ColorField
            id={id("fill")}
            value={layer.fill}
            palette={document.theme.palette}
            noneLabel={t("expert.shape.none")}
            onChange={(fill) => set({ fill })}
          />
        </Row>
      )}
      <Row
        label={line ? t("expert.shape.color") : t("expert.shape.stroke")}
        htmlFor={id("stroke")}
      >
        <ColorField
          id={id("stroke")}
          value={stroke?.color ?? null}
          palette={document.theme.palette}
          noneLabel={line ? undefined : t("expert.shape.none")}
          onChange={(color) =>
            set({ stroke: color ? withStroke({ color }) : null })
          }
        />
      </Row>
      {stroke ? (
        <>
          <Row label={t("expert.shape.width")} htmlFor={id("width")}>
            <NumberField
              id={id("width")}
              unit="mm"
              value={stroke.width}
              step={0.1}
              min={0.05}
              max={20}
              decimals={2}
              onCommit={(width) => set({ stroke: withStroke({ width }) })}
              onPreview={(width) =>
                onPreview(
                  width === null ? null : { stroke: withStroke({ width }) },
                )
              }
            />
          </Row>
          <Row label={t("expert.shape.dash")} htmlFor={id("dash")}>
            <Select
              id={id("dash")}
              value={pattern}
              options={[
                { value: "solid", label: t("expert.shape.solid") },
                { value: "dashed", label: t("expert.shape.dashed") },
                { value: "dotted", label: t("expert.shape.dotted") },
                ...(pattern === "custom"
                  ? [
                      {
                        value: "custom" as const,
                        label: t("expert.shape.custom"),
                      },
                    ]
                  : []),
              ]}
              onChange={(next) => {
                if (next === "custom") return;
                set({
                  stroke: withStroke({
                    dash: next === "solid" ? undefined : [...dashes[next]],
                  }),
                });
              }}
            />
          </Row>
        </>
      ) : null}
      {layer.shape === "rect" ? (
        <Row label={t("expert.shape.radius")} htmlFor={id("radius")}>
          <NumberField
            id={id("radius")}
            unit="mm"
            value={layer.radius}
            step={0.5}
            min={0}
            max={Math.min(layer.frame.width, layer.frame.height) / 2}
            decimals={1}
            onCommit={(radius) => set({ radius })}
            onPreview={(radius) =>
              onPreview(radius === null ? null : { radius })
            }
          />
        </Row>
      ) : null}
    </Section>
  );
}
