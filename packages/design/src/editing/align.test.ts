import { describe, expect, test } from "bun:test";
import { alignPlacements, distributePlacements } from "./align";

const placed = (x: number, y: number, width: number, height = 10) => ({
  frame: { x, y, width, height },
  rotation: 0,
});

describe("alignPlacements", () => {
  const items = [placed(10, 10, 20), placed(40, 30, 40), placed(25, 60, 10)];

  test("lines layers up on the edges of the box around them", () => {
    expect(alignPlacements(items, "left").map((frame) => frame.x)).toEqual([
      10, 10, 10,
    ]);
    expect(alignPlacements(items, "right").map((frame) => frame.x)).toEqual([
      60, 40, 70,
    ]);
    expect(alignPlacements(items, "bottom").map((frame) => frame.y)).toEqual([
      60, 60, 60,
    ]);
  });

  test("centres layers on each other or on the face", () => {
    expect(
      alignPlacements(items, "center").map(
        (frame) => frame.x + frame.width / 2,
      ),
    ).toEqual([45, 45, 45]);
    const face = { x: 0, y: 0, width: 120, height: 170 };
    expect(alignPlacements([items[0]!], "middle", face)[0]?.y).toBe(80);
  });

  test("lines a turned layer up by what it covers", () => {
    const turned = {
      frame: { x: 0, y: 0, width: 20, height: 10 },
      rotation: 90,
    };
    const [frame] = alignPlacements([turned], "left", {
      x: 0,
      y: 0,
      width: 100,
      height: 100,
    });
    // Upright it covers x 5–15, so it moves 5 mm left.
    expect(frame?.x).toBeCloseTo(-5);
  });
});

describe("distributePlacements", () => {
  test("spaces layers evenly between the first and the last", () => {
    const frames = distributePlacements(
      [placed(0, 0, 10), placed(70, 0, 10), placed(20, 0, 20)],
      "x",
    );
    expect(frames.map((frame) => frame.x)).toEqual([0, 70, 30]);
  });

  test("leaves fewer than three layers alone", () => {
    const items = [placed(0, 0, 10), placed(50, 0, 10)];
    expect(distributePlacements(items, "y")).toEqual(
      items.map((item) => item.frame),
    );
  });
});
