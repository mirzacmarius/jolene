"use client";

import type { DesignDocument, FaceName, Fields } from "@jolene/design";
import {
  AssemblyView,
  FaceView,
  type RenderContext,
  useCanvasMeasure,
} from "@jolene/design/react";
import { useMemo } from "react";

/** A file a design draws, as the backend resolves it from its key. */
export interface AssetLink {
  key: string;
  url: string;
  recolorable: boolean;
}

/** Looks assets up by key, for the renderer. */
export function useAssetResolver(assets: readonly AssetLink[] | undefined) {
  return useMemo(() => {
    const byKey = new Map(assets?.map((asset) => [asset.key, asset]));
    return (key: string) => byKey.get(key);
  }, [assets]);
}

export type PreviewView =
  | { kind: "assembly" }
  | { kind: "face"; piece: string; face: FaceName; guides?: boolean };

/**
 * A design as it will look printed: the whole item together, or one side of
 * one piece. Text is measured with the browser's fonts once they've loaded.
 */
export function DesignPreview({
  document,
  fields,
  assets,
  view = { kind: "assembly" },
  title,
  className,
}: {
  document: DesignDocument;
  fields: Fields;
  assets: readonly AssetLink[] | undefined;
  view?: PreviewView;
  title?: string;
  className?: string;
}) {
  const measure = useCanvasMeasure();
  const resolve = useAssetResolver(assets);
  const context = useMemo<RenderContext>(
    () => ({ fields, assets: resolve, measure }),
    [fields, resolve, measure],
  );
  return view.kind === "assembly" ? (
    <AssemblyView
      document={document}
      context={context}
      title={title}
      className={className}
    />
  ) : (
    <FaceView
      document={document}
      piece={view.piece}
      face={view.face}
      guides={view.guides}
      context={context}
      title={title}
      className={className}
    />
  );
}
