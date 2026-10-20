import { readFileSync } from "node:fs";
import type { Face, FontSource } from "./fonts";

/** The faces tests draw with (fixtures/fonts), by family. */
const files: Record<string, string> = {
  Jost: "Jost-Regular.ttf",
  Bellefair: "Bellefair-Regular.ttf",
  "Noto Sans Symbols 2": "NotoSansSymbols2-subset.ttf",
  "Noto Sans Symbols": "NotoSansSymbols-subset.ttf",
  "Noto Sans Math": "NotoSansMath-subset.ttf",
};

/** A font source for tests, which notes each face it's asked for. */
export function fixtureFonts(): { source: FontSource; asked: Face[] } {
  const asked: Face[] = [];
  const source: FontSource = async (face) => {
    asked.push(face);
    const file = files[face.family];
    if (!file || face.weight !== 400 || face.italic)
      throw new Error(`No test font for ${JSON.stringify(face)}`);
    return new Uint8Array(
      readFileSync(new URL(`../fixtures/fonts/${file}`, import.meta.url)),
    );
  };
  return { source, asked };
}
