import { describe, expect, test } from "bun:test";
import { paperTextures } from "../catalog";
import {
  type GrainKind,
  grainLevel,
  grainMm,
  grainTile,
  grainTiles,
} from "./grain";

const kinds: GrainKind[] = [...paperTextures, "cloth"];

/** A tile's pixels as signed values: lighter above 0, darker below. */
function values(kind: GrainKind, level = 0) {
  const { size, data } = grainTile(kind, level);
  const at = (x: number, y: number) => {
    const i = (y * size + x) * 4;
    return ((data[i] ?? 0) > 0 ? 1 : -1) * (data[i + 3] ?? 0);
  };
  return { size, at };
}

/** How much neighbouring columns differ, on average, `x` and `x + 1`. */
function step({ size, at }: ReturnType<typeof values>, x: number) {
  let sum = 0;
  for (let y = 0; y < size; y++)
    sum += Math.abs(at((x + 1) % size, y) - at(x, y));
  return sum / size;
}

describe("grain tiles", () => {
  test("are the same on every visit", () => {
    for (const kind of kinds)
      expect(grainTile(kind).data).toEqual(grainTile(kind).data);
  });

  test("differ from kind to kind", () => {
    expect(grainTile("cotton").data).not.toEqual(grainTile("kraft").data);
  });

  // A seam would show as a line every tile across a sheet or the table.
  test("repeat without a seam", () => {
    for (const kind of kinds) {
      const tile = values(kind);
      let inside = 0;
      for (let x = 0; x < tile.size - 1; x++) inside += step(tile, x);
      inside /= tile.size - 1;
      expect([kind, step(tile, tile.size - 1) < inside * 1.6 + 1]).toEqual([
        kind,
        true,
      ]);
    }
  });

  test("halve their pixels at each level of detail", () => {
    const finest = grainTile("cloth");
    const coarser = grainTile("cloth", 1);
    expect(coarser.size).toBe(finest.size / 2);
    expect(coarser.data.length).toBe(finest.data.length / 4);
    expect(coarser.mm).toBe(finest.mm);
  });

  test("come at every level of detail from one drawing", () => {
    for (const kind of kinds) {
      const tiles = grainTiles(kind);
      // Every level grainLevel picks is drawn.
      expect(tiles.length).toBe(grainLevel(kind, 0.01) + 1);
      tiles.forEach((tile, level) => {
        expect(tile.data).toEqual(grainTile(kind, level).data);
      });
    }
  });
});

describe("grainLevel", () => {
  test("draws the finest grain when the screen isn't known", () => {
    expect(grainLevel("linen")).toBe(0);
    expect(grainLevel("linen", 0)).toBe(0);
  });

  test("draws coarser grain for a screen that shows less", () => {
    const sharp = grainLevel("cloth", 16);
    const soft = grainLevel("cloth", 3);
    expect(soft).toBeGreaterThan(sharp);
    // Never much coarser than the screen shows.
    const { size, mm } = grainTile("cloth", soft);
    expect(size / mm).toBeGreaterThanOrEqual(3 * 0.75);
  });

  test("keeps tiles at least 32 pixels across", () => {
    for (const kind of kinds) {
      const { size } = grainTile(kind, grainLevel(kind, 0.01));
      expect(size).toBeGreaterThanOrEqual(32);
      expect(grainMm(kind)).toBeGreaterThan(0);
    }
  });
});
