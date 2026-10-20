import { useEffect, useMemo, useState } from "react";
import { estimateWidth, type Measure } from "../text-layout";
import { fontStack } from "./shared";

/** Size the canvas measures at; widths scale linearly from it. */
const REFERENCE_PX = 100;

/** Texts whose fonts have been asked for, in every measure. */
const requested = new Set<string>();

/**
 * Measures text with the browser's loaded fonts. Until a font has loaded the
 * browser would measure its fallback, so those widths come from the estimate
 * instead; re-render once `document.fonts` reports the font ready.
 */
export function createCanvasMeasure(): Measure {
  if (typeof document === "undefined") return estimateWidth;
  const context = document.createElement("canvas").getContext("2d");
  if (!context) return estimateWidth;
  const cache = new Map<string, number>();
  // The letters each font has loaded for. Asking the page's fonts is slow
  // with many faces, and laying out text asks for every line it tries.
  const ready = new Map<string, Set<string>>();
  const loaded = (css: string, text: string) => {
    const letters = ready.get(css) ?? new Set<string>();
    if ([...text].every((letter) => letters.has(letter))) return true;
    if (!document.fonts.check(css, text)) return false;
    for (const letter of text) letters.add(letter);
    ready.set(css, letters);
    return true;
  };
  return (text, font, sizeMm) => {
    const css = `${font.italic ? "italic " : ""}${font.weight} ${REFERENCE_PX}px ${fontStack(font.family)}`;
    const key = `${css}|${text}`;
    let width = cache.get(key);
    // Only a text whose fonts have loaded is measured and kept, so asking
    // the fonts again (which is slow) is needed only for a new text.
    if (width === undefined) {
      if (!loaded(css, text)) {
        // A web font comes in subsets by alphabet, and the browser fetches
        // one only for letters it draws. Some letters fall in two subsets,
        // such as ă in Latin Extended and Vietnamese, and the second is never
        // drawn, so ask for every face the text needs; "loadingdone" then
        // measures again.
        if (!requested.has(key)) {
          requested.add(key);
          // A face that fails to load keeps the estimate.
          document.fonts.load(css, text).catch(() => {});
        }
        return estimateWidth(text, font, sizeMm);
      }
      context.font = css;
      // The renderer draws text kerned (react/layers.tsx), as the print file
      // does; a canvas left on "auto" measures some pairs unkerned.
      context.fontKerning = "normal";
      width = context.measureText(text).width;
      cache.set(key, width);
    }
    return (width / REFERENCE_PX) * sizeMm;
  };
}

/**
 * A measure that follows the page's fonts: the estimate on the first render,
 * as the server drew it, so hydration matches; then the browser's own metrics,
 * measured again whenever a font finishes loading.
 */
export function useCanvasMeasure(): Measure {
  const [generation, setGeneration] = useState(0);
  useEffect(() => {
    const remeasure = () => setGeneration((current) => current + 1);
    remeasure();
    document.fonts.addEventListener("loadingdone", remeasure);
    return () => document.fonts.removeEventListener("loadingdone", remeasure);
  }, []);
  return useMemo(
    () => (generation === 0 ? estimateWidth : createCanvasMeasure()),
    [generation],
  );
}
