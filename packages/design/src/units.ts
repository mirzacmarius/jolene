/**
 * A design is laid out in millimetres, the unit printers quote paper and bleed
 * in, and type is sized in points, the unit designers set it in. Screens and
 * print files convert from these at the edge.
 */

export const MM_PER_INCH = 25.4;
export const POINTS_PER_INCH = 72;
export const MM_PER_POINT = MM_PER_INCH / POINTS_PER_INCH;

export function ptToMm(points: number): number {
  return points * MM_PER_POINT;
}

export function mmToPt(mm: number): number {
  return mm / MM_PER_POINT;
}

/** Pixels needed to print `mm` at `dpi`; print files are checked at 300 dpi. */
export function mmToPx(mm: number, dpi: number): number {
  return (mm / MM_PER_INCH) * dpi;
}

export function pxToMm(px: number, dpi: number): number {
  return (px / dpi) * MM_PER_INCH;
}

/** Rounds to a tenth of a millimetre, finer than any cutter or printer holds. */
export function roundMm(mm: number): number {
  return Math.round(mm * 10) / 10;
}
