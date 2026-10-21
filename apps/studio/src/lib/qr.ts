import { encode } from "uqr";

/**
 * A link as a QR code, for a family's invitation on paper or on a screen:
 * one SVG path of its dark squares, and a PNG to download. Medium error
 * correction keeps a printed code readable when a corner is smudged.
 */

/** The code's squares as a path in a `size` × `size` box, quiet zone included. */
export function qrPath(text: string) {
  const { size, data } = encode(text, { ecc: "M", border: 2 });
  let path = "";
  data.forEach((row, y) => {
    row.forEach((dark, x) => {
      if (dark) path += `M${x} ${y}h1v1h-1z`;
    });
  });
  return { size, path };
}

/** The code as a PNG about `pixels` wide, black on white, every square whole. */
export function qrPng(text: string, pixels = 1024): Promise<Blob> {
  const { size, data } = encode(text, { ecc: "M", border: 2 });
  const scale = Math.max(1, Math.floor(pixels / size));
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size * scale;
  const context = canvas.getContext("2d");
  if (!context) return Promise.reject(new Error("No canvas"));
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = "#000000";
  data.forEach((row, y) => {
    row.forEach((dark, x) => {
      if (dark) context.fillRect(x * scale, y * scale, scale, scale);
    });
  });
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("No image"))),
      "image/png",
    ),
  );
}

/** Saves a file the page made, under the name given. */
export function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
