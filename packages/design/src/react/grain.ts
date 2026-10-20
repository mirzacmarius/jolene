import { useCallback, useEffect, useSyncExternalStore } from "react";
import type { PaperTexture } from "../catalog";

/**
 * Paper and cloth as small tiles that repeat without a seam: the tooth of
 * cotton paper, the weave pressed into linen card, the fibres of kraft, the
 * cloud in vellum, and the linen tablecloth the lifelike preview lies on.
 *
 * Each pixel is white or black with some opacity, so laid over any colour a
 * tile lightens or darkens it: the paper's relief lit from the top left, and
 * the fibres in it. The tiles are drawn once per page in the browser from a
 * fixed seed, so every preview shows the same paper, and each covers a fixed
 * size on paper, so the grain is as fine on a welcome sign as on a place card.
 */

export type GrainKind = PaperTexture | "cloth";

export interface GrainTile {
  /** Side of the square tile, in pixels. */
  size: number;
  /** Side of the tile on paper, in millimetres. */
  mm: number;
  /** RGBA, row by row. */
  data: Uint8ClampedArray;
}

/** A value per pixel of a square tile, row by row. */
type Field = Float32Array;

const at = (field: Field, index: number) => field[index] ?? 0;
const mod = (n: number, m: number) => ((n % m) + m) % m;
const fade = (t: number) => t * t * t * (t * (t * 6 - 15) + 10);

/** A small seeded generator, so a tile is the same on every visit. */
export function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A seed from a name, so each tile or seal has its own randomness. */
export function seedOf(name: string): number {
  let hash = 2166136261;
  for (const char of name)
    hash = Math.imul(hash ^ (char.codePointAt(0) ?? 0), 16777619);
  return hash >>> 0;
}

/**
 * Value noise that repeats across the tile: a lattice of `cellsX` by
 * `cellsY` random values, eased between, wrapping at the edges.
 */
function noise(
  size: number,
  cellsX: number,
  cellsY: number,
  random: () => number,
): Field {
  const lattice = new Float32Array(cellsX * cellsY);
  for (let i = 0; i < lattice.length; i++) lattice[i] = random() * 2 - 1;
  // The column each pixel falls in, and how far across it, worked out once.
  const columns = new Int32Array(size * 2);
  const across = new Float32Array(size);
  for (let x = 0; x < size; x++) {
    const gx = (x / size) * cellsX;
    const x0 = Math.floor(gx);
    columns[x * 2] = mod(x0, cellsX);
    columns[x * 2 + 1] = mod(x0 + 1, cellsX);
    across[x] = fade(gx - x0);
  }
  const field = new Float32Array(size * size);
  for (let y = 0; y < size; y++) {
    const gy = (y / size) * cellsY;
    const y0 = Math.floor(gy);
    const ty = fade(gy - y0);
    const row0 = mod(y0, cellsY) * cellsX;
    const row1 = mod(y0 + 1, cellsY) * cellsX;
    for (let x = 0; x < size; x++) {
      const c0 = columns[x * 2] ?? 0;
      const c1 = columns[x * 2 + 1] ?? 0;
      const tx = at(across, x);
      const a = at(lattice, row0 + c0);
      const b = at(lattice, row0 + c1);
      const c = at(lattice, row1 + c0);
      const d = at(lattice, row1 + c1);
      const top = a + (b - a) * tx;
      field[y * size + x] = top + (c + (d - c) * tx - top) * ty;
    }
  }
  return field;
}

/** Octaves of noise, each twice as fine and `persistence` times as strong. */
function fractal(
  size: number,
  cells: number,
  octaves: number,
  persistence: number,
  random: () => number,
): Field {
  const field = new Float32Array(size * size);
  let amplitude = 1;
  for (let octave = 0; octave < octaves; octave++) {
    const scale = cells * 2 ** octave;
    if (scale > size / 2) break;
    add(field, noise(size, scale, scale, random), amplitude);
    amplitude *= persistence;
  }
  return field;
}

/** Adds `amount` of `source` into `target`, pixel by pixel. */
function add(target: Field, source: Field, amount: number): Field {
  for (let i = 0; i < target.length; i++)
    target[i] = at(target, i) + at(source, i) * amount;
  return target;
}

/** Softens a field with a 3×3 box, wrapping round the edges. */
function soften(field: Field, size: number): Field {
  const soft = new Float32Array(size * size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let sum = 0;
      for (let dy = -1; dy <= 1; dy++)
        for (let dx = -1; dx <= 1; dx++)
          sum += at(field, mod(y + dy, size) * size + mod(x + dx, size));
      soft[y * size + x] = sum / 9;
    }
  }
  return soft;
}

/**
 * Short fibres laid at random, wrapping round the tile's edges: the fibres
 * felted into cotton, the strands and specks in kraft.
 */
function fibres(
  field: Field,
  size: number,
  random: () => number,
  {
    count,
    length,
    value,
    bend,
    thick = false,
  }: {
    count: number;
    /** Shortest and longest, in pixels. */
    length: [number, number];
    /** Added along the fibre; the sign lightens or darkens. */
    value: [number, number];
    /** Most a fibre turns per pixel, in radians. */
    bend: number;
    /** Two pixels wide rather than one, to show at a distance. */
    thick?: boolean;
  },
) {
  for (let n = 0; n < count; n++) {
    let x = random() * size;
    let y = random() * size;
    let angle = random() * Math.PI * 2;
    const steps = Math.round(length[0] + random() * (length[1] - length[0]));
    const strength = value[0] + random() * (value[1] - value[0]);
    const turn = (random() - 0.5) * 2 * bend;
    for (let step = 0; step < steps; step++) {
      // Fibres thin out towards their ends.
      const taper = Math.sin((Math.PI * (step + 0.5)) / steps);
      const px = Math.round(x);
      const py = Math.round(y);
      const index = mod(py, size) * size + mod(px, size);
      field[index] = at(field, index) + strength * taper;
      if (thick) {
        // The second pixel to the fibre's side.
        const side =
          Math.abs(Math.cos(angle)) > Math.abs(Math.sin(angle))
            ? mod(py + 1, size) * size + mod(px, size)
            : mod(py, size) * size + mod(px + 1, size);
        field[side] = at(field, side) + strength * taper * 0.7;
      }
      x += Math.cos(angle);
      y += Math.sin(angle);
      angle += turn;
    }
  }
}

/**
 * The light a relief catches, lit from the top left: slopes facing the light
 * brighten, slopes facing away darken.
 */
function relief(heights: Field, size: number): Field {
  const shade = new Float32Array(size * size);
  for (let y = 0; y < size; y++) {
    const up = mod(y - 1, size) * size;
    const down = mod(y + 1, size) * size;
    for (let x = 0; x < size; x++) {
      const row = y * size;
      const dx =
        at(heights, row + mod(x + 1, size)) -
        at(heights, row + mod(x - 1, size));
      const dy = at(heights, down + x) - at(heights, up + x);
      shade[row + x] = dx + dy;
    }
  }
  return shade;
}

/** Scales a field so a typical pixel lies within ±`spread`. */
function normalise(field: Field, spread: number): Field {
  let sum = 0;
  for (let i = 0; i < field.length; i++) sum += at(field, i) ** 2;
  const deviation = Math.sqrt(sum / field.length) || 1;
  for (let i = 0; i < field.length; i++)
    field[i] = (at(field, i) / deviation) * spread;
  return field;
}

/**
 * Halves a field's resolution, wrapping round its edges. Each pixel takes a
 * weighted mean of the four rows and columns round it (1, 3, 3, 1), which
 * smooths away detail too fine to keep rather than folding it into moiré.
 */
function halve(field: Field, size: number): Field {
  const half = size / 2;
  const rows = new Float32Array(half * size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < half; x++) {
      const row = y * size;
      rows[y * half + x] =
        (at(field, row + mod(2 * x - 1, size)) +
          3 * at(field, row + 2 * x) +
          3 * at(field, row + 2 * x + 1) +
          at(field, row + mod(2 * x + 2, size))) /
        8;
    }
  }
  const small = new Float32Array(half * half);
  for (let y = 0; y < half; y++) {
    for (let x = 0; x < half; x++) {
      small[y * half + x] =
        (at(rows, mod(2 * y - 1, size) * half + x) +
          3 * at(rows, 2 * y * half + x) +
          3 * at(rows, (2 * y + 1) * half + x) +
          at(rows, mod(2 * y + 2, size) * half + x)) /
        8;
    }
  }
  return small;
}

/**
 * A plain weave of flax threads, each passing over one thread and under the
 * next: the threads' heights, and each thread's own shade. Linen is spun
 * unevenly, so threads differ a little in thickness and colour and swell
 * here and there into short slubs; nothing stands out enough to show where
 * the tile repeats.
 */
function weave(size: number, threads: number, random: () => number) {
  const heights = new Float32Array(size * size);
  const tone = new Float32Array(size * size);
  const pitch = size / threads;
  const width = Float32Array.from(
    { length: threads * 2 },
    () => 0.78 + random() * 0.3,
  );
  // Mostly near the middle, seldom far from it.
  const shade = Float32Array.from(
    { length: threads * 2 },
    () => (random() + random() - 1) * 0.7,
  );
  // Along each thread, a few random knots: where one rises well above the
  // rest the thread swells into a slub.
  const knots = 9;
  const slub = Float32Array.from({ length: threads * 2 * knots }, () =>
    random(),
  );
  const slubAt = (thread: number, along: number) => {
    const t = (along / size) * knots;
    const k = Math.floor(t);
    const a = at(slub, thread * knots + mod(k, knots));
    const b = at(slub, thread * knots + mod(k + 1, knots));
    const value = a + (b - a) * fade(t - k);
    return Math.max(0, value - 0.72) * 2.2;
  };
  for (let y = 0; y < size; y++) {
    const v = y / pitch;
    const row = Math.floor(v);
    const b = v - row;
    for (let x = 0; x < size; x++) {
      const u = x / pitch;
      const column = Math.floor(u);
      const a = u - column;
      const index = y * size + x;
      // The warp (running down) lies on top where row and column add up to
      // an even number, the weft (running across) elsewhere.
      const warpOnTop = (row + column) % 2 === 0;
      const along = warpOnTop ? b : a;
      const acrossThread = warpOnTop ? a : b;
      const thread = warpOnTop ? column : threads + row;
      const swell = slubAt(thread, warpOnTop ? y : x);
      const thick = at(width, thread) * (1 + swell);
      // A rounded thread, rising where it crosses over.
      const profile = 1 - Math.min(1, ((2 * acrossThread - 1) / thick) ** 2);
      heights[index] = profile * (0.55 + 0.45 * Math.sin(Math.PI * along));
      tone[index] = (at(shade, thread) + swell * 0.8) * profile;
    }
  }
  return { heights, tone };
}

interface Recipe {
  size: number;
  mm: number;
  /** The strongest lightening or darkening, as an opacity. */
  strength: number;
  draw: (size: number, random: () => number) => Field;
}

const recipes: Record<GrainKind, Recipe> = {
  // Smooth card: a fine, even tooth, barely there.
  smooth: {
    size: 128,
    mm: 8,
    strength: 0.05,
    draw: (size, random) =>
      normalise(relief(fractal(size, 32, 2, 0.6, random), size), 0.3),
  },
  // Cotton: soft felted bumps, and fibres lying in them.
  cotton: {
    size: 256,
    mm: 20,
    strength: 0.1,
    draw: (size, random) => {
      const heights = normalise(fractal(size, 16, 4, 0.7, random), 1);
      fibres(heights, size, random, {
        count: 120,
        length: [10, 28],
        value: [0.6, 1.2],
        bend: 0.05,
      });
      const shade = normalise(relief(soften(heights, size), size), 0.32);
      return add(shade, normalise(fractal(size, 8, 3, 0.5, random), 1), 0.06);
    },
  },
  // Linen card: a fabric's cross-hatch pressed into the paper, in short,
  // uneven ridges.
  linen: {
    size: 256,
    mm: 12.8,
    strength: 0.16,
    draw: (size, random) => {
      const lines = 32;
      const dashesAcross = noise(size, 12, lines, random);
      const dashesDown = noise(size, lines, 12, random);
      const wander = noise(size, 4, 4, random);
      const heights = new Float32Array(size * size);
      for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
          const index = y * size + x;
          const drift = at(wander, index) * 0.6;
          const across =
            Math.sin((Math.PI * lines * y) / size + drift) ** 2 *
            Math.max(0, 0.55 + at(dashesAcross, index));
          const down =
            Math.sin((Math.PI * lines * x) / size - drift) ** 2 *
            Math.max(0, 0.55 + at(dashesDown, index));
          heights[index] = across + down;
        }
      }
      return normalise(relief(soften(heights, size), size), 0.34);
    },
  },
  // Pearlescent card: smooth, with flecks of mica that catch the light.
  pearl: {
    size: 128,
    mm: 8,
    strength: 0.22,
    draw: (size, random) => {
      const shade = normalise(
        relief(fractal(size, 32, 2, 0.6, random), size),
        0.08,
      );
      for (let i = 0; i < 70; i++) {
        const x = Math.floor(random() * size);
        const y = Math.floor(random() * size);
        const glint = 0.5 + random() * 0.5;
        shade[y * size + x] = glint;
        shade[y * size + mod(x + 1, size)] = glint * 0.5;
        shade[mod(y + 1, size) * size + x] = glint * 0.5;
      }
      return shade;
    },
  },
  // Kraft: a mottled brown, flecked with dark strands and specks; flatter
  // than cotton.
  kraft: {
    size: 256,
    mm: 20,
    strength: 0.24,
    draw: (size, random) => {
      // Mottled only finely: broad blotches would show the tile repeating.
      const tone = normalise(fractal(size, 16, 3, 0.6, random), 0.07);
      fibres(tone, size, random, {
        count: 260,
        length: [6, 30],
        value: [-0.1, -0.32],
        bend: 0.02,
        thick: true,
      });
      fibres(tone, size, random, {
        count: 420,
        length: [3, 18],
        value: [-0.12, -0.4],
        bend: 0.03,
      });
      fibres(tone, size, random, {
        count: 140,
        length: [4, 16],
        value: [0.12, 0.3],
        bend: 0.02,
        thick: true,
      });
      for (let i = 0; i < 70; i++) {
        const x = Math.floor(random() * size);
        const y = Math.floor(random() * size);
        const dark = 0.45 + random() * 0.4;
        for (const [dx, dy, share] of [
          [0, 0, 1],
          [1, 0, 0.6],
          [0, 1, 0.6],
          [1, 1, 0.35],
        ] as const) {
          const index = mod(y + dy, size) * size + mod(x + dx, size);
          tone[index] = at(tone, index) - dark * share;
        }
      }
      return add(
        tone,
        normalise(relief(fractal(size, 16, 3, 0.55, random), size), 1),
        0.07,
      );
    },
  },
  // Vellum: milky clouds in a smooth sheet.
  vellum: {
    size: 128,
    mm: 32,
    strength: 0.1,
    draw: (size, random) => {
      const clouds = normalise(fractal(size, 4, 4, 0.55, random), 0.5);
      for (let i = 0; i < clouds.length; i++)
        clouds[i] = Math.max(0, at(clouds, i));
      return add(clouds, normalise(fractal(size, 32, 1, 0.5, random), 1), 0.1);
    },
  },
  // A linen tablecloth: an uneven plain weave of flax threads.
  cloth: {
    size: 288,
    mm: 24,
    strength: 0.22,
    draw: (size, random) => {
      const { heights, tone } = weave(size, 48, random);
      const shade = normalise(relief(heights, size), 0.28);
      // Fuzz from loose fibres; no broader mottling, which would show the
      // tile repeating across a whole table.
      add(shade, normalise(tone, 1), 0.1);
      return add(shade, normalise(fractal(size, 72, 1, 0.5, random), 1), 0.05);
    },
  },
};

/** How much paper or cloth one tile covers, in millimetres. */
export const grainMm = (kind: GrainKind) => recipes[kind].mm;

/** The smallest a tile gets, in pixels. */
const SMALLEST = 32;

/**
 * Which of a tile's levels of detail suits a screen showing `pixelsPerMm`
 * device pixels to the millimetre: each level has half the pixels of the
 * one before. Scaled down on screen, a tile's finest detail shimmers into
 * moiré, so the level drawn is the coarsest one the screen shows at about
 * its own size or a little larger. Level 0, the finest, when the screen's
 * density isn't known.
 */
export function grainLevel(kind: GrainKind, pixelsPerMm?: number): number {
  if (!pixelsPerMm || !(pixelsPerMm > 0)) return 0;
  const { size, mm } = recipes[kind];
  let level = 0;
  while (
    size / 2 ** (level + 1) >= SMALLEST &&
    size / 2 ** (level + 1) / mm >= pixelsPerMm * 0.75
  )
    level++;
  return level;
}

/**
 * Draws one tile at a level of detail (see grainLevel). Pure, so it runs and
 * is tested without a browser.
 */
export function grainTile(kind: GrainKind, level = 0): GrainTile {
  const recipe = recipes[kind];
  let field = recipe.draw(recipe.size, seededRandom(seedOf(kind)));
  let size = recipe.size;
  for (let i = 0; i < level && size / 2 >= SMALLEST; i++) {
    field = halve(field, size);
    size /= 2;
  }
  const data = new Uint8ClampedArray(field.length * 4);
  for (let i = 0; i < field.length; i++) {
    const value = Math.max(-1, Math.min(1, at(field, i)));
    const light = value > 0 ? 255 : 0;
    data[i * 4] = light;
    data[i * 4 + 1] = light;
    data[i * 4 + 2] = light;
    data[i * 4 + 3] = Math.round(Math.abs(value) * recipe.strength * 255);
  }
  return { size, mm: recipe.mm, data };
}

/** A tile at one level of detail, as the store keeps it. */
type TileKey = `${GrainKind}/${number}`;

const urls = new Map<TileKey, string>();
const pending = new Set<TileKey>();
const listeners = new Set<() => void>();
let drawn = 0;

/** Paints a tile on a canvas and keeps its address. */
function paint(kind: GrainKind, level: number) {
  const tile = grainTile(kind, level);
  const canvas = document.createElement("canvas");
  canvas.width = tile.size;
  canvas.height = tile.size;
  const context = canvas.getContext("2d");
  if (!context) return;
  const image = context.createImageData(tile.size, tile.size);
  image.data.set(tile.data);
  context.putImageData(image, 0, 0);
  urls.set(`${kind}/${level}`, canvas.toDataURL("image/png"));
  drawn += 1;
  for (const listener of listeners) listener();
}

/** Runs a task when the browser has a moment, one tile at a time. */
function whenIdle(task: () => void) {
  if (typeof requestIdleCallback === "function")
    requestIdleCallback(task, { timeout: 300 });
  else setTimeout(task, 0);
}

/**
 * Draws the tiles a preview needs, each in its own idle moment so a page
 * never stalls on them; previews already showing pick each one up as it's
 * ready.
 */
export function requestGrains(
  kinds: readonly GrainKind[],
  pixelsPerMm?: number,
) {
  if (typeof document === "undefined") return;
  for (const kind of kinds) {
    const level = grainLevel(kind, pixelsPerMm);
    const key: TileKey = `${kind}/${level}`;
    if (urls.has(key) || pending.has(key)) continue;
    pending.add(key);
    whenIdle(() => {
      pending.delete(key);
      if (!urls.has(key)) paint(kind, level);
    });
  }
}

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

/** The drawn tile of a kind closest in detail to `level`, if any is. */
function nearest(kind: GrainKind, level: number): string | undefined {
  for (let apart = 0; apart <= 4; apart++) {
    const url =
      urls.get(`${kind}/${level - apart}`) ??
      urls.get(`${kind}/${level + apart}`);
    if (url) return url;
  }
  return undefined;
}

/**
 * The addresses of the tiles a preview draws, at the detail a screen of
 * `pixelsPerMm` device pixels to the millimetre shows (see grainLevel).
 * None while the server renders or the page hydrates, so both draw the same
 * markup; each tile then appears once it's drawn, and while a finer or
 * coarser one is drawn for a new zoom the one already there stays.
 */
export function useGrains(
  kinds: readonly GrainKind[],
  pixelsPerMm?: number,
): (kind: GrainKind) => string | undefined {
  const key = [...new Set(kinds)].sort().join(" ");
  const generation = useSyncExternalStore(
    subscribe,
    () => drawn,
    () => -1,
  );
  useEffect(() => {
    if (key) requestGrains(key.split(" ") as GrainKind[], pixelsPerMm);
  }, [key, pixelsPerMm]);
  return useCallback(
    (kind: GrainKind) =>
      generation < 0 ? undefined : nearest(kind, grainLevel(kind, pixelsPerMm)),
    [generation, pixelsPerMm],
  );
}
