import { describe, expect, test } from "bun:test";
import type { Layer } from "../schema";
import {
  normalizeRotation,
  placementBounds,
  placementContains,
  rotatePoint,
  unionBounds,
} from "./frames";
import { hitLayer, layersInBox } from "./hit";

const rect = (
  id: string,
  frame: Layer["frame"],
  extra: Partial<Layer> = {},
): Layer =>
  ({
    id,
    type: "shape",
    shape: "rect",
    frame,
    rotation: 0,
    opacity: 1,
    hidden: false,
    locked: false,
    ink: "print",
    fill: "#000000",
    stroke: null,
    radius: 0,
    ...extra,
  }) as Layer;

describe("placed frames", () => {
  test("turn clockwise about the centre, as SVG does", () => {
    const turned = rotatePoint({ x: 10, y: 0 }, { x: 0, y: 0 }, 90);
    expect(turned.x).toBeCloseTo(0);
    expect(turned.y).toBeCloseTo(10);
  });

  test("keep angles between -180 and 180", () => {
    expect(normalizeRotation(190)).toBe(-170);
    expect(normalizeRotation(-180)).toBe(180);
    expect(normalizeRotation(720)).toBe(0);
    expect(Object.is(normalizeRotation(-360), 0)).toBe(true);
  });

  test("cover a wider upright box when turned", () => {
    const bounds = placementBounds({
      frame: { x: 0, y: 0, width: 20, height: 10 },
      rotation: 90,
    });
    expect(bounds.x).toBeCloseTo(5);
    expect(bounds.y).toBeCloseTo(-5);
    expect(bounds.width).toBeCloseTo(10);
    expect(bounds.height).toBeCloseTo(20);
    expect(unionBounds([bounds, { x: 30, y: 0, width: 5, height: 5 }])).toEqual(
      { x: bounds.x, y: bounds.y, width: 30 - bounds.x + 5, height: 20 },
    );
    expect(unionBounds([])).toBeNull();
  });

  test("contain points on the turned frame, not its upright box", () => {
    const diamond = {
      frame: { x: 0, y: 0, width: 10, height: 10 },
      rotation: 45,
    };
    // The frame's corner is outside a square turned 45°…
    expect(placementContains(diamond, { x: 0.3, y: 0.3 })).toBe(false);
    // …and its top corner now sits above the frame.
    expect(placementContains(diamond, { x: 5, y: -1.5 })).toBe(true);
    expect(placementContains(diamond, { x: 5, y: 5 })).toBe(true);
  });
});

describe("hitLayer", () => {
  const layers = [
    rect("background", { x: 0, y: 0, width: 100, height: 100 }),
    rect("art", { x: 10, y: 10, width: 50, height: 50 }, { locked: true }),
    rect("words", { x: 20, y: 20, width: 20, height: 10 }),
    rect("hidden", { x: 20, y: 20, width: 20, height: 10 }, { hidden: true }),
    rect("turned", { x: 60, y: 60, width: 30, height: 4 }, {
      rotation: 90,
    } as Partial<Layer>),
  ];

  test("picks the topmost visible layer under the point", () => {
    expect(hitLayer(layers, { x: 25, y: 25 })?.id).toBe("words");
    expect(hitLayer(layers, { x: 95, y: 5 })?.id).toBe("background");
    expect(hitLayer(layers, { x: 120, y: 5 })).toBeUndefined();
  });

  test("passes over locked layers unless asked", () => {
    expect(hitLayer(layers, { x: 15, y: 15 })?.id).toBe("background");
    expect(
      hitLayer(layers, { x: 15, y: 15 }, { includeLocked: true })?.id,
    ).toBe("art");
  });

  test("follows a layer's rotation", () => {
    // Turned upright, the 30 × 4 bar runs from y 47 to 77 at x 73–77.
    expect(hitLayer(layers, { x: 75, y: 50 })?.id).toBe("turned");
    expect(hitLayer(layers, { x: 85, y: 62 })?.id).toBe("background");
  });

  test("reaches a hairline within the tolerance", () => {
    const line = [rect("line", { x: 0, y: 10, width: 50, height: 0.2 })];
    expect(hitLayer(line, { x: 25, y: 11 })).toBeUndefined();
    expect(hitLayer(line, { x: 25, y: 11 }, { tolerance: 1 })?.id).toBe("line");
  });

  test("finds the layers a marquee touches", () => {
    expect(
      layersInBox(layers, { x: 18, y: 18, width: 4, height: 4 }).map(
        (layer) => layer.id,
      ),
    ).toEqual(["background", "words"]);
  });
});
