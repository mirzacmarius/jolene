import { type FontFamilyName, fontFamilies } from "../catalog";
import type { Fields } from "../fields";
import type { Measure } from "../text-layout";

export interface ResolvedAsset {
  url: string;
  /** Single-colour line art that a layer's tint can repaint. */
  recolorable: boolean;
}

/** Looks up an asset by its key; undefined while it is loading or missing. */
export type AssetResolver = (key: string) => ResolvedAsset | undefined;

export interface RenderContext {
  fields: Fields;
  assets: AssetResolver;
  measure?: Measure;
}

const fallbacks = { script: "cursive", serif: "serif", sans: "sans-serif" };

export function fontStack(family: FontFamilyName): string {
  return `"${family}", ${fallbacks[fontFamilies[family].category]}`;
}

/** Ids from React's useId, made safe for url(#…) references. */
export function svgId(reactId: string, suffix: string): string {
  return `j${reactId.replace(/[^a-zA-Z0-9]/g, "")}-${suffix}`;
}
