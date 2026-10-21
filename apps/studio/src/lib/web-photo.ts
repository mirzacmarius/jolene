/** The longest side of a photo the shop shows, in pixels (ADR 0016). */
const LONG_SIDE = 2048;

/** The kinds of photo the shop shows; anything else becomes a JPEG. */
const TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

/** How much of a JPEG's or WebP's detail is kept. */
const QUALITY = 0.85;

/** A file the browser can't read as a picture. */
export class NotAPhoto extends Error {}

/**
 * A photo made fit for the web as the photo store's are (ADR 0016): at most
 * 2048 pixels a side, turned upright, in sRGB and without the camera's
 * metadata, such as where it was taken, in its own format.
 */
export async function webPhoto(file: Blob): Promise<Blob> {
  const address = URL.createObjectURL(file);
  try {
    const picture = new Image();
    picture.src = address;
    await picture.decode().catch(() => {
      throw new NotAPhoto();
    });
    const width = picture.naturalWidth;
    const height = picture.naturalHeight;
    if (!width || !height) throw new NotAPhoto();
    const scale = Math.min(1, LONG_SIDE / Math.max(width, height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(width * scale));
    canvas.height = Math.max(1, Math.round(height * scale));
    const context = canvas.getContext("2d");
    if (!context) throw new Error("No canvas");
    const type = TYPES.has(file.type) ? file.type : "image/jpeg";
    // A JPEG has no transparency, which would turn black.
    if (type === "image/jpeg") {
      context.fillStyle = "#fff";
      context.fillRect(0, 0, canvas.width, canvas.height);
    }
    context.imageSmoothingQuality = "high";
    context.drawImage(picture, 0, 0, canvas.width, canvas.height);
    // A browser that can't write WebP writes a PNG, which the shop shows too.
    return await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error("No photo"))),
        type,
        QUALITY,
      ),
    );
  } finally {
    URL.revokeObjectURL(address);
  }
}
