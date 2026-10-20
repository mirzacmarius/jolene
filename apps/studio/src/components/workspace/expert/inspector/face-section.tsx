"use client";

import {
  type DesignDocument,
  type FaceName,
  type Operation,
  type Piece,
  type PieceShape,
  paletteTokens,
  type StockId,
  stocks,
} from "@jolene/design";
import { useCurrentLocale, useI18n } from "@/locales/client";
import { StylePanel } from "../../style-panel";
import {
  ColorField,
  HexField,
  NumberField,
  Row,
  Section,
  Select,
} from "./fields";

type ShapeKind = PieceShape["kind"];

/**
 * With nothing selected: the piece and the face themselves (the paper, its
 * colour, the printed background, the cut), the palette's five colours, and
 * simple mode's style choices for the whole design.
 */
export function FaceSection({
  document,
  piece,
  face,
  apply,
}: {
  document: DesignDocument;
  piece: Piece;
  face: FaceName;
  apply: (operations: Operation[]) => void;
}) {
  const t = useI18n();
  const locale = useCurrentLocale();
  const update = (set: Extract<Operation, { op: "updatePiece" }>["set"]) =>
    apply([{ op: "updatePiece", piece: piece.id, face, set }]);
  const shape = piece.shape;
  const id = (name: string) => `${name}-${piece.id}-${face}`;
  const changeShape = (kind: ShapeKind) => {
    if (kind === shape.kind || kind === "die") return;
    update({
      shape:
        kind === "rect"
          ? { kind, radius: 0 }
          : kind === "scallop"
            ? { kind, count: 12 }
            : { kind: "arch" },
    });
  };

  return (
    <>
      <Section
        title={`${piece.name ?? piece.id} · ${face === "back" ? t("design.backSide") : t("design.front")}`}
      >
        <p className="text-[12px] leading-relaxed text-muted-foreground">
          {t("expert.face.lead")}
        </p>
        <Row label={t("expert.face.stock")} htmlFor={id("stock")}>
          <Select
            id={id("stock")}
            value={piece.stock}
            options={(Object.keys(stocks) as StockId[]).map((stock) => ({
              value: stock,
              label: stocks[stock].labels[locale],
            }))}
            onChange={(stock) => update({ stock })}
          />
        </Row>
        <Row label={t("expert.face.paperColor")} htmlFor={id("paper")}>
          <ColorField
            id={id("paper")}
            value={piece.paper}
            palette={document.theme.palette}
            noneLabel={t("expert.face.paperOwn")}
            onChange={(paper) => update({ paper })}
          />
        </Row>
        <Row label={t("expert.face.background")} htmlFor={id("background")}>
          <ColorField
            id={id("background")}
            value={piece[face]?.background ?? null}
            palette={document.theme.palette}
            noneLabel={t("expert.face.noBackground")}
            onChange={(background) => update({ background })}
          />
        </Row>
        <Row label={t("expert.face.shape")} htmlFor={id("shape")}>
          {shape.kind === "die" ? (
            <span className="text-[13px]">{t("expert.face.die")}</span>
          ) : (
            <Select
              id={id("shape")}
              value={shape.kind}
              options={[
                { value: "rect", label: t("expert.face.rect") },
                { value: "arch", label: t("expert.face.arch") },
                { value: "scallop", label: t("expert.face.scallop") },
              ]}
              onChange={changeShape}
            />
          )}
        </Row>
        {shape.kind === "rect" ? (
          <Row label={t("expert.face.radius")} htmlFor={id("radius")}>
            <NumberField
              id={id("radius")}
              unit="mm"
              value={shape.radius}
              min={0}
              max={Math.min(piece.width, piece.height) / 2}
              step={0.5}
              onCommit={(radius) => update({ shape: { kind: "rect", radius } })}
            />
          </Row>
        ) : null}
        {shape.kind === "scallop" ? (
          <Row label={t("expert.face.scallops")} htmlFor={id("count")}>
            <NumberField
              id={id("count")}
              value={shape.count}
              min={4}
              max={40}
              decimals={0}
              onCommit={(count) =>
                update({ shape: { kind: "scallop", count } })
              }
            />
          </Row>
        ) : null}
      </Section>

      <Section title={t("expert.face.palette")}>
        {paletteTokens.map((token) => (
          <Row
            key={token}
            label={t(`expert.palette.${token}`)}
            htmlFor={id(`palette-${token}`)}
          >
            <HexField
              id={id(`palette-${token}`)}
              value={document.theme.palette[token]}
              onChange={(color) =>
                apply([{ op: "setPalette", palette: { [token]: color } }])
              }
            />
          </Row>
        ))}
      </Section>

      <div className="px-4 py-5">
        <StylePanel document={document} apply={apply} />
      </div>
    </>
  );
}
