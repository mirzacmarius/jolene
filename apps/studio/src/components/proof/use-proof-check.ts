"use client";

import {
  type CheckOptions,
  checkDesign,
  type DesignCheck,
  type DesignDocument,
  type Fields,
  faceNames,
  type PictureSize,
} from "@jolene/design";
import { createCanvasBounds, createCanvasMeasure } from "@jolene/design/react";
import { useEffect, useMemo, useState } from "react";
import { type AssetLink, useAssetResolver } from "../design/design-preview";
import { loadDesignFonts } from "../design/render-image";

/** The files of the couple's own photos in the design, by asset key. */
function photoKeys(design: DesignDocument) {
  const keys = new Set<string>();
  for (const piece of design.pieces)
    for (const face of faceNames)
      for (const layer of piece[face]?.layers ?? [])
        if (layer.type === "image" && layer.replaceable && layer.asset)
          keys.add(layer.asset);
  return [...keys];
}

/**
 * The pixel sizes of the couple's photos as the browser loads them: null for
 * one that doesn't load. Jolene's own artwork is the workshop's to check.
 */
function usePhotoSizes(
  design: DesignDocument,
  resolve: (key: string) => AssetLink | undefined,
) {
  const [sizes, setSizes] = useState<Record<string, PictureSize | null>>({});
  const keys = photoKeys(design).join("\n");
  useEffect(() => {
    let live = true;
    for (const key of keys.split("\n").filter(Boolean)) {
      const url = resolve(key)?.url;
      if (!url) continue;
      const image = new Image();
      image.onload = () =>
        live &&
        setSizes((known) => ({
          ...known,
          [key]: { width: image.naturalWidth, height: image.naturalHeight },
        }));
      image.onerror = () =>
        live && setSizes((known) => ({ ...known, [key]: null }));
      image.src = url;
    }
    return () => {
      live = false;
    };
  }, [keys, resolve]);
  return sizes;
}

/**
 * What to look at before the design prints, checked as the print file checks
 * it (checkDesign), with the couple's own details and the browser's fonts:
 * undefined until the fonts of the design's words first load, so nothing is
 * measured in a stand-in, then checked again whenever new words have loaded.
 */
export function useProofCheck(
  design: DesignDocument,
  fields: Fields,
  assets: readonly AssetLink[],
): DesignCheck | undefined {
  const resolve = useAssetResolver(assets);
  const photos = usePhotoSizes(design, resolve);
  const [loads, setLoads] = useState(0);
  useEffect(() => {
    let live = true;
    loadDesignFonts(design, fields).then(() => {
      if (live) setLoads((count) => count + 1);
    });
    return () => {
      live = false;
    };
  }, [design, fields]);
  return useMemo(() => {
    if (loads === 0) return undefined;
    const picture: CheckOptions["picture"] = (layer) => {
      if (!resolve(layer.asset)) return null;
      return layer.replaceable ? photos[layer.asset] : undefined;
    };
    return checkDesign(design, fields, {
      measure: createCanvasMeasure(),
      bounds: createCanvasBounds(),
      picture,
    });
  }, [loads, design, fields, resolve, photos]);
}
