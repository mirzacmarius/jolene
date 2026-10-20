import type { Box } from "../geometry";

/**
 * The camera over a preview, for zooming in and moving about: how far it's
 * zoomed and how far it has moved. At zoom 1 the stage shows the whole item;
 * zoomed in, what the stage shows is scaled about the stage's centre and then
 * moved by x and y, in CSS pixels. Pure, for the page and its tests.
 */
export interface Camera {
  zoom: number;
  x: number;
  y: number;
}

export interface Size {
  width: number;
  height: number;
}

/** The whole item, as the stage first shows it. */
export const fittedCamera: Camera = { zoom: 1, x: 0, y: 0 };

/**
 * How far a stage may zoom in, given the CSS pixels to the millimetre it
 * shows at zoom 1: enough to see the paper's grain and the smallest type
 * up close, about four times life size, and never less than 4 times.
 */
export function mostZoom(pixelsPerMm: number): number {
  if (!(pixelsPerMm > 0)) return 4;
  return Math.min(8, Math.max(4, 16 / pixelsPerMm));
}

/**
 * The camera brought back within reach: zoomed between 1 and `most`, and
 * never moved so far that the stage shows past the edge of the table, which
 * is the stage's size at zoom 1.
 */
export function clampCamera(camera: Camera, stage: Size, most: number): Camera {
  const zoom = Math.min(most, Math.max(1, camera.zoom));
  const reachX = ((zoom - 1) * stage.width) / 2;
  const reachY = ((zoom - 1) * stage.height) / 2;
  return {
    zoom,
    x: Math.min(reachX, Math.max(-reachX, camera.x)),
    y: Math.min(reachY, Math.max(-reachY, camera.y)),
  };
}

/**
 * Zooms in by `factor` (below 1 zooms out), keeping what's under `at`, in
 * stage pixels from its top left, where it is: under the pointer, or between
 * two fingers.
 */
export function zoomCamera(
  camera: Camera,
  factor: number,
  at: { x: number; y: number },
  stage: Size,
  most: number,
): Camera {
  const zoom = Math.min(most, Math.max(1, camera.zoom * factor));
  const scale = zoom / camera.zoom;
  const dx = at.x - stage.width / 2;
  const dy = at.y - stage.height / 2;
  return clampCamera(
    { zoom, x: dx - (dx - camera.x) * scale, y: dy - (dy - camera.y) * scale },
    stage,
    most,
  );
}

/** Moves the camera with a drag, by `dx` and `dy` CSS pixels. */
export function panCamera(
  camera: Camera,
  dx: number,
  dy: number,
  stage: Size,
  most: number,
): Camera {
  return clampCamera(
    { ...camera, x: camera.x + dx, y: camera.y + dy },
    stage,
    most,
  );
}

/**
 * The CSS transform that shows the stage through the camera, for an element
 * the stage's size transformed about its centre (the default origin).
 */
export function cameraTransform(camera: Camera): string {
  return camera.zoom === 1 && camera.x === 0 && camera.y === 0
    ? ""
    : `translate(${camera.x}px, ${camera.y}px) scale(${camera.zoom})`;
}

/** The largest box of the given proportions, width to height, that fits in `area`, centred. */
export function fitBox(aspect: number, area: Box): Box {
  const width = Math.max(0, Math.min(area.width, area.height * aspect));
  const height = width / aspect;
  return {
    x: area.x + (area.width - width) / 2,
    y: area.y + (area.height - height) / 2,
    width,
    height,
  };
}
