import { describe, expect, test } from "bun:test";
import sharp from "sharp";
import { readPicture } from "./pictures";

const terracotta = { r: 192, g: 112, b: 64 };
const blank = (width: number, height: number, alpha = 1) =>
  sharp({
    create: {
      width,
      height,
      channels: alpha < 1 ? 4 : 3,
      background: { ...terracotta, alpha },
    },
  });

describe("readPicture", () => {
  test("keeps an upright JPEG as it came", async () => {
    const jpeg = new Uint8Array(await blank(40, 20).jpeg().toBuffer());
    expect(await readPicture(jpeg)).toEqual({ width: 40, height: 20, jpeg });
  });

  test("turns a photo upright", async () => {
    // A phone's portrait photo: stored sideways, with an EXIF orientation.
    const sideways = new Uint8Array(
      await blank(40, 20).jpeg().withMetadata({ orientation: 6 }).toBuffer(),
    );
    const picture = await readPicture(sideways);
    expect(picture).toMatchObject({ width: 20, height: 40 });
    expect("jpeg" in picture && picture.jpeg).not.toEqual(sideways);
  });

  test("embeds an opaque PNG as a JPEG", async () => {
    const png = new Uint8Array(await blank(30, 10).png().toBuffer());
    const picture = await readPicture(png);
    expect(picture).toMatchObject({ width: 30, height: 10 });
    expect("jpeg" in picture).toBe(true);
    const { format } = await sharp(
      "jpeg" in picture ? picture.jpeg : png,
    ).metadata();
    expect(format).toBe("jpeg");
  });

  test("keeps artwork's transparency apart from its colour", async () => {
    const png = new Uint8Array(await blank(2, 1, 0.5).png().toBuffer());
    const picture = await readPicture(png);
    expect(picture).toEqual({
      width: 2,
      height: 1,
      rgb: new Uint8Array([192, 112, 64, 192, 112, 64]),
      alpha: new Uint8Array([128, 128]),
    });
  });
});
