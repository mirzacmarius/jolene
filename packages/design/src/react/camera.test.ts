import { describe, expect, test } from "bun:test";
import {
  type Camera,
  cameraTransform,
  clampCamera,
  fitBox,
  fittedCamera,
  mostZoom,
  panCamera,
  zoomCamera,
} from "./camera";

const stage = { width: 800, height: 600 };

/** Where a point of the stage at zoom 1 shows through the camera. */
const seen = (camera: Camera, x: number, y: number) => ({
  x: stage.width / 2 + (x - stage.width / 2) * camera.zoom + camera.x,
  y: stage.height / 2 + (y - stage.height / 2) * camera.zoom + camera.y,
});

describe("zoomCamera", () => {
  test("keeps what's under the pointer where it is", () => {
    const camera = zoomCamera(fittedCamera, 2, { x: 600, y: 200 }, stage, 8);
    expect(camera.zoom).toBe(2);
    expect(seen(camera, 600, 200)).toEqual({ x: 600, y: 200 });
    // Again, from a camera already zoomed and moved.
    const closer = zoomCamera(camera, 1.5, { x: 300, y: 400 }, stage, 8);
    const before = {
      x: stage.width / 2 + (300 - stage.width / 2 - camera.x) / camera.zoom,
      y: stage.height / 2 + (400 - stage.height / 2 - camera.y) / camera.zoom,
    };
    const after = seen(closer, before.x, before.y);
    expect(after.x).toBeCloseTo(300);
    expect(after.y).toBeCloseTo(400);
  });

  test("zooms between the whole item and the most it may", () => {
    expect(zoomCamera(fittedCamera, 0.5, { x: 0, y: 0 }, stage, 4)).toEqual(
      fittedCamera,
    );
    expect(zoomCamera(fittedCamera, 20, { x: 0, y: 0 }, stage, 4).zoom).toBe(4);
  });

  test("comes back to the middle as it zooms out", () => {
    const zoomed = zoomCamera(fittedCamera, 3, { x: 790, y: 590 }, stage, 8);
    const back = zoomCamera(zoomed, 1 / 3, { x: 10, y: 10 }, stage, 8);
    expect(back.zoom).toBeCloseTo(1);
    expect(back.x).toBeCloseTo(0);
    expect(back.y).toBeCloseTo(0);
  });
});

describe("panCamera", () => {
  test("never shows past the table's edge", () => {
    const zoomed = { zoom: 2, x: 0, y: 0 };
    expect(panCamera(zoomed, 1000, -1000, stage, 8)).toEqual({
      zoom: 2,
      x: 400,
      y: -300,
    });
    expect(panCamera(fittedCamera, 50, 50, stage, 8)).toEqual(fittedCamera);
  });
});

describe("clampCamera", () => {
  test("leaves a camera within reach as it is", () => {
    const camera = { zoom: 3, x: -120, y: 80 };
    expect(clampCamera(camera, stage, 8)).toEqual(camera);
  });
});

describe("cameraTransform", () => {
  test("is no transform at all for the whole item", () => {
    expect(cameraTransform(fittedCamera)).toBe("");
    expect(cameraTransform({ zoom: 2, x: 10, y: -4 })).toBe(
      "translate(10px, -4px) scale(2)",
    );
  });
});

describe("mostZoom", () => {
  test("zooms further into what's shown small", () => {
    expect(mostZoom(4)).toBe(4);
    expect(mostZoom(1)).toBe(8);
    expect(mostZoom(2.5)).toBeCloseTo(6.4);
    expect(mostZoom(0)).toBe(4);
  });
});

describe("fitBox", () => {
  test("fits by the side that runs out first, centred", () => {
    const area = { x: 10, y: 20, width: 400, height: 300 };
    expect(fitBox(1, area)).toEqual({ x: 60, y: 20, width: 300, height: 300 });
    expect(fitBox(4, area)).toEqual({
      x: 10,
      y: 120,
      width: 400,
      height: 100,
    });
  });
});
