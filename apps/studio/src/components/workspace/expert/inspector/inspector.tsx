"use client";

import type {
  DesignDocument,
  FaceName,
  FaceRef,
  Fields,
  Layer,
  LayerChanges,
  Operation,
  Piece,
  TextLayer,
} from "@jolene/design";
import { replaceLayer } from "@jolene/design";
import type { AssetResolver } from "@jolene/design/react";
import { memo } from "react";
import { useI18n } from "@/locales/client";
import type { Artwork } from "../add-menu";
import { kindIcons, layerKind, useLayerLabel } from "../layer-label";
import { FaceSection } from "./face-section";
import { TextField } from "./fields";
import { ImageSection } from "./image-section";
import { LayerSection } from "./layer-section";
import { SelectionSection } from "./selection-section";
import { ShapeSection } from "./shape-section";
import { type TextFocus, TextSection } from "./text-section";

/**
 * The right-hand panel: what the selection is and every property it has, or
 * the face itself when nothing is selected. Each change is one batch of
 * operations, kept in the history. It draws again only when the design or
 * the selection changes, not while a change is previewed.
 */
export const Inspector = memo(function Inspector({
  document,
  piece,
  face,
  ordered,
  orderedCorners,
  selection,
  onSelect,
  fields,
  artwork,
  resolve,
  apply,
  onPreview,
  focus,
}: {
  document: DesignDocument;
  piece: Piece;
  face: FaceName;
  /** The shop sells the design: the Finisaje tab picks its paper and wax. */
  ordered: boolean;
  /** Its product's order options pick the corners too, on the Finisaje tab. */
  orderedCorners: boolean;
  selection: readonly string[];
  onSelect: (ids: string[]) => void;
  fields: Fields;
  artwork: readonly Artwork[] | undefined;
  resolve: AssetResolver;
  apply: (operations: Operation[]) => void;
  onPreview: (id: string, changes: LayerChanges | null) => void;
  focus: TextFocus | null;
}) {
  const target: FaceRef = { piece: piece.id, face };
  const layers = piece[face]?.layers ?? [];
  const selected = selection.flatMap((id) => {
    const layer = layers.find((candidate) => candidate.id === id);
    return layer ? [layer] : [];
  });

  if (selected.length === 0)
    return (
      <FaceSection
        key={`${piece.id}:${face}`}
        document={document}
        piece={piece}
        face={face}
        ordered={ordered}
        orderedCorners={orderedCorners}
        apply={apply}
      />
    );
  if (selected.length > 1)
    return (
      <SelectionSection
        document={document}
        target={target}
        layers={selected}
        apply={apply}
        onSelect={onSelect}
      />
    );
  const layer = selected[0] as Layer;
  const preview = (changes: LayerChanges | null) =>
    onPreview(layer.id, changes);
  return (
    // Fields belong to their layer: another layer starts them afresh.
    <div key={layer.id}>
      <LayerHeader
        document={document}
        target={target}
        layer={layer}
        apply={apply}
      />
      {layer.type === "text" ? (
        <TextSection
          document={document}
          target={target}
          layer={layer as TextLayer}
          fields={fields}
          apply={apply}
          onPreview={preview}
          focus={focus}
        />
      ) : layer.type === "image" ? (
        <ImageSection
          document={document}
          target={target}
          layer={layer}
          artwork={artwork}
          resolve={resolve}
          apply={apply}
        />
      ) : (
        <ShapeSection
          document={document}
          target={target}
          layer={layer}
          apply={apply}
          onPreview={preview}
        />
      )}
      <LayerSection
        document={document}
        piece={piece}
        target={target}
        layer={layer}
        apply={apply}
        onPreview={preview}
        onSelect={onSelect}
      />
    </div>
  );
});

/** The layer's kind and its name, which can be written over. */
function LayerHeader({
  document,
  target,
  layer,
  apply,
}: {
  document: DesignDocument;
  target: FaceRef;
  layer: Layer;
  apply: (operations: Operation[]) => void;
}) {
  const t = useI18n();
  const label = useLayerLabel();
  const kind = layerKind(layer);
  const Icon = kindIcons[kind];
  return (
    <div className="border-b border-border/70 px-4 py-3">
      <p className="mb-2 flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
        <Icon className="size-3.5" aria-hidden />
        {t(`expert.kind.${kind}`)}
      </p>
      <TextField
        value={layer.name ?? ""}
        placeholder={label({ ...layer, name: undefined } as Layer)}
        maxLength={80}
        label={t("expert.layers.rename")}
        onCommit={(name) => {
          if (name)
            apply([
              { op: "updateLayer", ...target, layer: layer.id, set: { name } },
            ]);
          else if (layer.name) {
            // An operation can't take a name away; the layer goes back without one.
            const { name: _name, ...unnamed } = layer;
            apply(replaceLayer(document, target, unnamed as Layer));
          }
        }}
      />
    </div>
  );
}
