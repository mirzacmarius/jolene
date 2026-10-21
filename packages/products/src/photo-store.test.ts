import { expect, test } from "bun:test";
import sharp from "sharp";
import {
  copyPhotos,
  type Destination,
  photoType,
  webCopy,
} from "./photo-store";

/** A JPEG as a camera might save it: 6 asks for a quarter turn clockwise. */
const jpeg = (width: number, height: number, orientation = 1) =>
  sharp({ create: { width, height, channels: 3, background: "#c9a7a0" } })
    .jpeg()
    .withMetadata({ orientation })
    .toBuffer();

test("a copy is upright, 2048 pixels at most, without the camera's metadata", async () => {
  const copy = await sharp(
    await webCopy(await jpeg(4096, 3072, 6), "image/jpeg"),
  ).metadata();
  expect([copy.format, copy.width, copy.height]).toEqual(["jpeg", 1536, 2048]);
  expect(copy.orientation).toBeUndefined();
  expect(copy.exif).toBeUndefined();
});

test("a smaller photo keeps its size, and a PNG its transparency", async () => {
  const png = await sharp({
    create: { width: 800, height: 600, channels: 4, background: "#0000" },
  })
    .png()
    .toBuffer();
  const copy = await sharp(await webCopy(png, "image/png")).metadata();
  expect([copy.format, copy.width, copy.height, copy.hasAlpha]).toEqual([
    "png",
    800,
    600,
    true,
  ]);
});

test("photos are JPEGs or PNGs", () => {
  expect(photoType("jolene.ro/2021/10/a.JPG")).toBe("image/jpeg");
  expect(photoType("jolene.ro/2021/10/a.jpeg")).toBe("image/jpeg");
  expect(photoType("jolene.ro/2021/10/a.png")).toBe("image/png");
  expect(() => photoType("jolene.ro/2021/10/a.gif")).toThrow();
});

const uploads = "https://jolene.ro/wp-content/uploads/2021/10/";

/** A store that holds had.jpg, and remembers what it's given. */
function store() {
  const saved: string[] = [];
  const destination: Destination = {
    paths: async () => new Set(["jolene.ro/2021/10/had.jpg"]),
    save: async (path) => void saved.push(path),
    address: () => undefined,
  };
  return { saved, destination };
}

test("copies the photos the store lacks, once each, past one that fails", async () => {
  const { saved, destination } = store();
  const photo = await jpeg(10, 10);
  const report = await copyPhotos(
    [
      `${uploads}had.jpg`,
      `${uploads}new.jpg`,
      `${uploads}new.jpg`,
      `${uploads}gone.jpg`,
    ],
    destination,
    {
      fetchPhoto: async (url) => {
        if (url.endsWith("gone.jpg")) throw new Error(`404 for ${url}`);
        return photo;
      },
    },
  );
  expect(report.had).toBe(1);
  expect(report.copied).toEqual([`${uploads}new.jpg`]);
  expect(report.failed.map(({ url }) => url)).toEqual([`${uploads}gone.jpg`]);
  expect(saved).toEqual(["jolene.ro/2021/10/new.jpg"]);
});

test("starts no copy once the deadline has passed", async () => {
  const { saved, destination } = store();
  const report = await copyPhotos([`${uploads}new.jpg`], destination, {
    deadline: 0,
    fetchPhoto: () => jpeg(10, 10),
  });
  expect(report.left).toEqual([`${uploads}new.jpg`]);
  expect(saved).toEqual([]);
});
