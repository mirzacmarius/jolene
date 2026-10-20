import { describe, expect, test } from "bun:test";
import type { Frame } from "../schema";
import { placementCorners } from "./frames";
import { resizeFrame, rotateTo, snapResize } from "./transform";

const frame: Frame = { x: 10, y: 20, width: 40, height: 20 };

function expectFrame(actual: Frame, expected: Frame) {
  for (const key of ["x", "y", "width", "height"] as const)
    expect(actual[key]).toBeCloseTo(expected[key]);
}

describe("resizeFrame", () => {
  test("moves the dragged edge and keeps the opposite one", () => {
    expectFrame(
      resizeFrame({
        frame,
        rotation: 0,
        handle: "e",
        pointer: { x: 60, y: 0 },
      }),
      { x: 10, y: 20, width: 50, height: 20 },
    );
    expectFrame(
      resizeFrame({
        frame,
        rotation: 0,
        handle: "nw",
        pointer: { x: 5, y: 10 },
      }),
      { x: 5, y: 10, width: 45, height: 30 },
    );
  });

  test("keeps the proportions with Shift", () => {
    expectFrame(
      resizeFrame({
        frame,
        rotation: 0,
        handle: "se",
        pointer: { x: 90, y: 41 },
        keepRatio: true,
      }),
      { x: 10, y: 20, width: 80, height: 40 },
    );
    // From an edge, the other side grows evenly about the middle.
    expectFrame(
      resizeFrame({
        frame,
        rotation: 0,
        handle: "e",
        pointer: { x: 90, y: 0 },
        keepRatio: true,
      }),
      { x: 10, y: 10, width: 80, height: 40 },
    );
  });

  test("never shrinks below the smallest size, nor turns inside out", () => {
    const tiny = resizeFrame({
      frame,
      rotation: 0,
      handle: "w",
      pointer: { x: 200, y: 0 },
    });
    expect(tiny.width).toBe(1);
    expect(tiny.x + tiny.width).toBeCloseTo(50);
  });

  test("keeps the opposite corner of a turned frame in place", () => {
    const rotation = 30;
    const before = placementCorners({ frame, rotation });
    const next = resizeFrame({
      frame,
      rotation,
      handle: "se",
      pointer: { x: 70, y: 60 },
    });
    const after = placementCorners({ frame: next, rotation });
    expect(after[0].x).toBeCloseTo(before[0].x);
    expect(after[0].y).toBeCloseTo(before[0].y);
    // The dragged corner lands under the pointer.
    expect(after[2].x).toBeCloseTo(70);
    expect(after[2].y).toBeCloseTo(60);
  });
});

describe("snapResize", () => {
  const face = { width: 120, height: 170, bleed: 3, safeMargin: 5 };

  test("snaps the dragged edge to a guide", () => {
    const { frame: next, guides } = snapResize({
      frame,
      rotation: 0,
      handle: "e",
      pointer: { x: 59.4, y: 0 },
      face,
      others: [],
      threshold: 1,
    });
    expectFrame(next, { x: 10, y: 20, width: 50, height: 20 });
    expect(guides).toEqual([{ axis: "x", at: 60, from: -3, to: 173 }]);
  });

  test("keeps the proportions while one edge follows a guide", () => {
    const { frame: next } = snapResize({
      frame,
      rotation: 0,
      handle: "se",
      pointer: { x: 89.6, y: 40.1 },
      keepRatio: true,
      face,
      others: [{ x: 0, y: 0, width: 90, height: 5 }],
      threshold: 1,
    });
    expectFrame(next, { x: 10, y: 20, width: 80, height: 40 });
  });

  test("doesn't snap a turned frame", () => {
    const { guides } = snapResize({
      frame,
      rotation: 10,
      handle: "e",
      pointer: { x: 59.6, y: 30 },
      face,
      others: [],
      threshold: 1,
    });
    expect(guides).toEqual([]);
  });
});

describe("rotateTo", () => {
  const centre = { x: 0, y: 0 };

  test("turns by the angle the pointer sweeps", () => {
    expect(
      rotateTo({
        centre,
        start: 10,
        from: { x: 0, y: -10 },
        to: { x: 10, y: 0 },
      }),
    ).toBe(100);
  });

  test("steps by 15° with Shift", () => {
    expect(
      rotateTo({
        centre,
        start: 0,
        from: { x: 0, y: -10 },
        to: { x: 10, y: -9 },
        step: 15,
      }),
    ).toBe(45);
  });

  test("stays between -180 and 180", () => {
    expect(
      rotateTo({
        centre,
        start: 170,
        from: { x: 0, y: -10 },
        to: { x: 10, y: 0 },
      }),
    ).toBe(-100);
  });
});
