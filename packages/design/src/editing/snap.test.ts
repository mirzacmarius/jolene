import { describe, expect, test } from "bun:test";
import { snapBox } from "./snap";

const face = { width: 120, height: 170, bleed: 3, safeMargin: 5 };

describe("snapBox", () => {
  test("centres a layer on the face", () => {
    const result = snapBox({
      box: { x: 39, y: 50, width: 40, height: 10 },
      mode: "move",
      face,
      others: [],
      threshold: 1.5,
    });
    expect(result.box.x).toBe(40);
    expect(result.snapped).toEqual({ x: "center", y: null });
    expect(result.guides).toEqual([{ axis: "x", at: 60, from: -3, to: 173 }]);
  });

  test("snaps to the trim, the safe margin and the bleed", () => {
    const at = (x: number) =>
      snapBox({
        box: { x, y: 80, width: 20, height: 10 },
        mode: "move",
        face,
        others: [],
        threshold: 1,
      }).box.x;
    expect(at(0.6)).toBe(0);
    expect(at(5.8)).toBe(5);
    expect(at(-2.4)).toBe(-3);
    expect(at(99.2)).toBe(100);
    expect(at(30)).toBe(30);
  });

  test("lines up with another layer's edge and draws across both", () => {
    const result = snapBox({
      box: { x: 20.6, y: 100, width: 30, height: 8 },
      mode: "move",
      face,
      others: [{ x: 20, y: 40, width: 50, height: 10 }],
      threshold: 1,
    });
    expect(result.box.x).toBe(20);
    expect(result.guides).toContainEqual({
      axis: "x",
      at: 20,
      from: 40,
      to: 108,
    });
  });

  test("takes the nearest line on each axis", () => {
    const result = snapBox({
      box: { x: 9.7, y: 9.2, width: 10, height: 10 },
      mode: "move",
      face,
      others: [{ x: 50, y: 10, width: 10, height: 10 }],
      threshold: 1,
    });
    // The top edge meets the other layer's top; the left edge is 0.3 from
    // the safe margin's 5? No: 9.7 is 4.7 away. It meets nothing on x.
    expect(result.box).toEqual({ x: 9.7, y: 10, width: 10, height: 10 });
    expect(result.snapped).toEqual({ x: null, y: "start" });
  });

  test("moves only the dragged edge when resizing", () => {
    const result = snapBox({
      box: { x: 30, y: 30, width: 29.4, height: 20 },
      mode: "resize",
      lines: { x: ["end"], y: [] },
      face,
      others: [],
      threshold: 1,
    });
    expect(result.box).toEqual({ x: 30, y: 30, width: 30, height: 20 });
    const fromStart = snapBox({
      box: { x: 4.6, y: 30, width: 20, height: 20 },
      mode: "resize",
      lines: { x: ["start"], y: [] },
      face,
      others: [],
      threshold: 1,
    });
    expect(fromStart.box.x).toBe(5);
    expect(fromStart.box.width).toBeCloseTo(19.6);
  });

  test("leaves a box that is nowhere near a line alone", () => {
    const box = { x: 33, y: 33, width: 11, height: 11 };
    const result = snapBox({
      box,
      mode: "move",
      face,
      others: [],
      threshold: 0.5,
    });
    expect(result.box).toEqual(box);
    expect(result.guides).toEqual([]);
  });
});
