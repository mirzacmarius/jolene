import { useEffect, useMemo, useState } from "react";
import { estimateWidth, type Measure } from "../text-layout";
import { fontStack } from "./shared";

/** Size the canvas measures at; widths scale linearly from it. */
const REFERENCE_PX = 100;

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
  return (text, font, sizeMm) => {
    const css = `${font.italic ? "italic " : ""}${font.weight} ${REFERENCE_PX}px ${fontStack(font.family)}`;
    if (!document.fonts.check(css, text))
      return estimateWidth(text, font, sizeMm);
    const key = `${css}|${text}`;
    let width = cache.get(key);
    if (width === undefined) {
      context.font = css;
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
