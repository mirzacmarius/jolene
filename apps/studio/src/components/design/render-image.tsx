"use client";

import {
  type DesignDocument,
  type Fields,
  type FontFamilyName,
  faceNames,
  fontFamilies,
  googleFontsHref,
  matchWeight,
  resolveText,
  symbolFonts,
} from "@jolene/design";
import {
  AssemblyView,
  createCanvasMeasure,
  FaceView,
  fontStack,
  type RenderContext,
} from "@jolene/design/react";
import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";
import type { AssetLink, PreviewView } from "./design-preview";

/**
 * A view of a design drawn into a canvas: the same renderer as the preview,
 * from the document rather than from the page, with its fonts and images
 * carried inside, so the picture doesn't depend on what else the page shows.
 * The AI designer sees the design this way, and a proof keeps a picture of
 * it for the order.
 */

/** Behind the assembled item, as the studio's preview shows it. */
const BACKDROP = "#efe9df";

/** How long the fonts may take to load before the picture goes without. */
const FONT_WAIT_MS = 5000;

/** How long the fonts inside the drawn image take to be ready. */
const FONT_SETTLE_MS = 250;

const SVG_NS = "http://www.w3.org/2000/svg";
const XLINK_NS = "http://www.w3.org/1999/xlink";

interface Typeface {
  family: FontFamilyName;
  weight: number;
  italic: boolean;
}

/** Every typeface the design's words are set in, with the words set in each. */
function typefacesOf(design: DesignDocument, fields: Fields) {
  const faces = new Map<string, { face: Typeface; text: string }>();
  const add = (face: Typeface, text: string) => {
    const key = `${face.family}|${face.weight}|${face.italic}`;
    const known = faces.get(key);
    faces.set(key, { face, text: (known?.text ?? "") + text });
  };
  const resolve = (text: string) =>
    resolveText(text, {
      fields,
      occasion: design.occasion,
      language: design.language,
    });
  for (const piece of design.pieces)
    for (const name of faceNames)
      for (const layer of piece[name]?.layers ?? []) {
        if (layer.type !== "text" || layer.hidden) continue;
        const style = { ...design.theme.text[layer.style], ...layer.overrides };
        add(
          { family: style.font, weight: style.weight, italic: style.italic },
          resolve(layer.text),
        );
      }
  for (const accessory of design.accessories)
    if (accessory.kind === "wax-seal" && accessory.motif.kind === "initials")
      add(
        { family: "Cormorant Garamond", weight: 600, italic: true },
        resolve(accessory.motif.text),
      );
  return [...faces.values()];
}

const cssFont = (face: Typeface) =>
  `${face.italic ? "italic " : ""}${face.weight} 16px ${fontStack(face.family)}`;

/** Loads the page's own fonts for the words, so they measure true. */
async function loadFonts(faces: { face: Typeface; text: string }[]) {
  const loads = faces.map(({ face, text }) =>
    document.fonts.load(cssFont(face), text || "Aa").catch(() => []),
  );
  await Promise.race([
    Promise.all(loads),
    new Promise((resolve) => setTimeout(resolve, FONT_WAIT_MS)),
  ]);
}

/**
 * Loads the page's fonts for every word of the design, so that a measure
 * made afterwards (createCanvasMeasure) measures them true.
 */
export async function loadDesignFonts(design: DesignDocument, fields: Fields) {
  await loadFonts(typefacesOf(design, fields));
}

const dataUrls = new Map<string, Promise<string>>();

/** A file as a data: URL, which an SVG drawn as an image may still read. */
function dataUrl(url: string): Promise<string> {
  let cached = dataUrls.get(url);
  if (!cached) {
    cached = fetch(url)
      .then((response) => {
        if (!response.ok) throw new Error(`${response.status} for ${url}`);
        return response.blob();
      })
      .then(
        (blob) =>
          new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = () => reject(reader.error);
            reader.readAsDataURL(blob);
          }),
      );
    cached.catch(() => dataUrls.delete(url));
    dataUrls.set(url, cached);
  }
  return cached;
}

const fontCss = new Map<string, Promise<string>>();

/**
 * The @font-face rules of the typefaces, from Google Fonts, with each face's
 * file inside as a data: URL: one file a face, holding every letter the
 * studio asks for (googleFontsHref).
 */
function embeddedFonts(faces: Typeface[]): Promise<string> {
  const wanted: { family: string; weight: number; style: string }[] = [
    ...faces.map((face) => ({
      family: face.family,
      weight: matchWeight(face.family, face.weight),
      style:
        face.italic && fontFamilies[face.family].italic ? "italic" : "normal",
    })),
    // The symbols the typefaces lack, as the page draws them (fontStack).
    ...symbolFonts.map((family) => ({ family, weight: 400, style: "normal" })),
  ];
  const key = JSON.stringify(
    wanted.map((face) => `${face.family}|${face.weight}|${face.style}`).sort(),
  );
  let cached = fontCss.get(key);
  if (!cached) {
    const families = [...new Set(faces.map((face) => face.family))];
    cached = fetch(googleFontsHref(families))
      .then((response) => response.text())
      .then(async (css) => {
        const rules: string[] = [];
        for (const match of css.matchAll(/@font-face\s*\{([^}]*)\}/g)) {
          const [, body = ""] = match;
          const family = /font-family:\s*'([^']+)'/.exec(body)?.[1];
          const style = /font-style:\s*(\w+)/.exec(body)?.[1];
          const weights = /font-weight:\s*(\d+)(?:\s+(\d+))?/.exec(body);
          const low = Number(weights?.[1]);
          const high = Number(weights?.[2] ?? low);
          const used = wanted.some(
            (face) =>
              face.family === family &&
              face.style === style &&
              face.weight >= low &&
              face.weight <= high,
          );
          const file = /url\(([^)]+)\)/.exec(body)?.[1];
          if (!used || !file) continue;
          rules.push(`@font-face {${body.replace(file, await dataUrl(file))}}`);
        }
        return rules.join("\n");
      });
    cached.catch(() => fontCss.delete(key));
    fontCss.set(key, cached);
  }
  return cached;
}

/** The view drawn by the renderer into an SVG element of its own. */
function drawView(
  design: DesignDocument,
  context: RenderContext,
  view: PreviewView,
) {
  const container = document.createElement("div");
  const root = createRoot(container);
  flushSync(() =>
    root.render(
      view.kind === "assembly" ? (
        <AssemblyView document={design} context={context} />
      ) : (
        <FaceView
          document={design}
          piece={view.piece}
          face={view.face}
          context={context}
        />
      ),
    ),
  );
  const svg = container.querySelector("svg")?.cloneNode(true);
  root.unmount();
  if (!(svg instanceof SVGSVGElement)) throw new Error("Nothing was drawn");
  return svg;
}

export const canvasBlob = (
  canvas: HTMLCanvasElement,
  type: string,
  quality?: number,
) =>
  new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("No image"))),
      type,
      quality,
    ),
  );

/**
 * Draws the view with its long side `longSide` pixels, over the studio's
 * backdrop, once the fonts of its words have loaded.
 */
export async function renderCanvas({
  design,
  fields,
  assets,
  view,
  longSide,
}: {
  design: DesignDocument;
  fields: Fields;
  assets: readonly AssetLink[];
  view: PreviewView;
  longSide: number;
}): Promise<HTMLCanvasElement> {
  const typefaces = typefacesOf(design, fields);
  await loadFonts(typefaces);
  const measure = createCanvasMeasure();
  const byKey = new Map(assets.map((asset) => [asset.key, asset]));
  const svg = drawView(
    design,
    { fields, assets: (key) => byKey.get(key), measure },
    view,
  );

  const box = svg.viewBox.baseVal;
  const scale = longSide / Math.max(box.width, box.height);
  const width = Math.round(box.width * scale);
  const height = Math.round(box.height * scale);
  svg.setAttribute("width", String(width));
  svg.setAttribute("height", String(height));
  svg.removeAttribute("style");
  svg.removeAttribute("class");
  await Promise.all(
    [...svg.querySelectorAll("image")].map(async (image) => {
      const href =
        image.getAttribute("href") ?? image.getAttributeNS(XLINK_NS, "href");
      if (!href || href.startsWith("data:")) return;
      try {
        image.setAttribute(
          "href",
          await dataUrl(new URL(href, window.location.href).href),
        );
      } catch {
        // An image that can't be fetched is left out of the picture.
        image.remove();
      }
    }),
  );
  try {
    const style = document.createElementNS(SVG_NS, "style");
    style.textContent = await embeddedFonts(typefaces.map(({ face }) => face));
    svg.insertBefore(style, svg.firstChild);
  } catch {
    // Without its fonts the picture still shows the layout.
  }

  const markup = new XMLSerializer().serializeToString(svg);
  const url = URL.createObjectURL(
    new Blob([markup], { type: "image/svg+xml" }),
  );
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    const context = canvas.getContext("2d");
    if (!context) throw new Error("No canvas");
    // The image loads a font the first time its words need it, after its
    // first drawing: draw once to start that, then again once they're in.
    context.drawImage(image, 0, 0, width, height);
    await new Promise((resolve) => setTimeout(resolve, FONT_SETTLE_MS));
    context.fillStyle = BACKDROP;
    context.fillRect(0, 0, width, height);
    context.drawImage(image, 0, 0, width, height);
  } finally {
    URL.revokeObjectURL(url);
  }
  return canvas;
}
