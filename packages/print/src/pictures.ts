import sharp from "sharp";

/**
 * An image as the print file embeds it. An opaque one is a JPEG, so a
 * couple's photo stays the size it came; one with transparency, such as
 * Jolene's artwork, keeps its pixels, with the alpha apart as PDF keeps it.
 */
export type Picture =
  | { width: number; height: number; jpeg: Uint8Array }
  | {
      width: number;
      height: number;
      /** RGB, three bytes a pixel. */
      rgb: Uint8Array;
      /** One byte a pixel. */
      alpha: Uint8Array;
    };

/** Decodes a PNG, JPEG or WebP file, turned upright and in sRGB. */
export async function readPicture(bytes: Uint8Array): Promise<Picture> {
  const metadata = await sharp(bytes).metadata();
  const image = sharp(bytes).rotate().toColourspace("srgb");
  const { data, info } = await image
    .clone()
    .ensureAlpha()
    .raw({ depth: "uchar" })
    .toBuffer({ resolveWithObject: true });
  const pixels = info.width * info.height;
  let opaque = true;
  for (let pixel = 0; pixel < pixels && opaque; pixel++)
    if (data[pixel * 4 + 3] !== 255) opaque = false;

  if (opaque) {
    // An upright sRGB JPEG goes in as it came.
    const asItCame =
      metadata.format === "jpeg" &&
      (metadata.orientation ?? 1) === 1 &&
      metadata.space === "srgb" &&
      metadata.channels === 3;
    const jpeg = asItCame
      ? bytes
      : new Uint8Array(
          await image
            .clone()
            .flatten()
            .jpeg({ quality: 92, chromaSubsampling: "4:4:4" })
            .toBuffer(),
        );
    return { width: info.width, height: info.height, jpeg };
  }

  const rgb = new Uint8Array(pixels * 3);
  const alpha = new Uint8Array(pixels);
  for (let pixel = 0; pixel < pixels; pixel++) {
    rgb[pixel * 3] = data[pixel * 4] as number;
    rgb[pixel * 3 + 1] = data[pixel * 4 + 1] as number;
    rgb[pixel * 3 + 2] = data[pixel * 4 + 2] as number;
    alpha[pixel] = data[pixel * 4 + 3] as number;
  }
  return { width: info.width, height: info.height, rgb, alpha };
}
