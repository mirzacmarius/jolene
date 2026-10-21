/**
 * Copies the catalog's photos to the photo store (ADR 0016), fit for the
 * web. scripts/photos.ts runs it; Convex never imports it.
 */
import { mkdir, readdir, writeFile } from "node:fs/promises";
import { dirname, join, relative } from "node:path";
import { list, put } from "@vercel/blob";
import sharp from "sharp";
import { photoFolder, photoPath } from "./photos";

/**
 * The longest side of a photo in the store: Shopify's size for product
 * photos, and more than the 1920 pixels the shop's pages ask Vercel's image
 * optimizer for.
 */
export const LONGEST_SIDE = 2048;

/** A copy's path never holds another photo, so it can be kept a year. */
const ONE_YEAR = 365 * 24 * 60 * 60;

export type PhotoType = "image/jpeg" | "image/png";

/** A photo's type from its name: jolene.ro's are JPEGs and a few PNGs. */
export function photoType(path: string): PhotoType {
  if (/\.jpe?g$/i.test(path)) return "image/jpeg";
  if (/\.png$/i.test(path)) return "image/png";
  throw new Error(`${path} is neither a JPEG nor a PNG`);
}

/**
 * A photo as the store keeps it: turned upright, at most 2048 pixels a
 * side, in sRGB, without the camera's metadata, in its own format.
 */
export async function webCopy(
  original: ArrayBuffer | Uint8Array,
  type: PhotoType,
): Promise<Buffer> {
  const image = sharp(original).rotate().resize(LONGEST_SIDE, LONGEST_SIDE, {
    fit: "inside",
    withoutEnlargement: true,
  });
  return type === "image/png"
    ? image.png({ compressionLevel: 9 }).toBuffer()
    : image.jpeg({ quality: 85, mozjpeg: true }).toBuffer();
}

/** Where copies go: the photo store, or a folder to look at them in. */
export type Destination = {
  /** The paths of the photos it already has. */
  paths(): Promise<Set<string>>;
  save(path: string, body: Buffer, type: PhotoType): Promise<void>;
  /** Its address, once it has said. */
  address(): string | undefined;
};

/**
 * The photo store, reached with the credentials Vercel gives the shop's
 * builds once the store is connected to the shop's project.
 */
export function blobStore(): Destination {
  let origin: string | undefined;
  const seen = (url: string) => {
    origin ??= new URL(url).origin;
  };
  return {
    async paths() {
      const paths = new Set<string>();
      let cursor: string | undefined;
      do {
        const page = await list({ prefix: photoFolder, limit: 1000, cursor });
        for (const blob of page.blobs) {
          paths.add(blob.pathname);
          seen(blob.url);
        }
        cursor = page.hasMore ? page.cursor : undefined;
      } while (cursor);
      return paths;
    },
    async save(path, body, type) {
      try {
        const blob = await put(path, body, {
          access: "public",
          addRandomSuffix: false,
          contentType: type,
          cacheControlMaxAge: ONE_YEAR,
        });
        seen(blob.url);
      } catch (error) {
        // Another build copied it first, and a path keeps its photo.
        if (!String(error).includes("already exists")) throw error;
      }
    },
    address: () => origin,
  };
}

/** A folder on this computer, laid out as the store would be. */
export function folder(root: string): Destination {
  return {
    async paths() {
      const entries = await readdir(root, {
        recursive: true,
        withFileTypes: true,
      }).catch(() => []);
      return new Set(
        entries
          .filter((entry) => entry.isFile())
          .map((entry) => relative(root, join(entry.parentPath, entry.name))),
      );
    },
    async save(path, body) {
      const file = join(root, path);
      await mkdir(dirname(file), { recursive: true });
      await writeFile(file, body);
    },
    address: () => root,
  };
}

/** Fetches a photo from jolene.ro, trying twice more when it fails. */
export async function download(url: string): Promise<ArrayBuffer> {
  for (let attempt = 1; ; attempt++) {
    try {
      const response = await fetch(url, {
        headers: { "user-agent": "Jolene photo copy (jolene.ro)" },
        signal: AbortSignal.timeout(60_000),
      });
      if (!response.ok) throw new Error(`${response.status} for ${url}`);
      return await response.arrayBuffer();
    } catch (error) {
      if (attempt === 3) throw error;
      await Bun.sleep(attempt * 2000);
    }
  }
}

export type CopyReport = {
  /** The photos the store had, and those it has now. */
  had: number;
  copied: string[];
  failed: { url: string; error: string }[];
  /** The photos the time allowed for didn't reach. */
  left: string[];
};

/**
 * Copies the photos a destination lacks, several at a time, and starts no
 * more once the deadline has passed. A photo that fails doesn't stop the
 * others.
 */
export async function copyPhotos(
  urls: Iterable<string>,
  to: Destination,
  {
    fetchPhoto = download,
    deadline = Number.POSITIVE_INFINITY,
    workers = 4,
    log = () => {},
  }: {
    fetchPhoto?: (url: string) => Promise<ArrayBuffer | Uint8Array>;
    /** When to stop starting copies, in milliseconds since 1970. */
    deadline?: number;
    workers?: number;
    log?: (line: string) => void;
  } = {},
): Promise<CopyReport> {
  const have = await to.paths();
  const all = [...new Set(urls)].sort();
  const missing = all.filter((url) => !have.has(photoPath(url)));
  const report: CopyReport = {
    had: all.length - missing.length,
    copied: [],
    failed: [],
    left: [],
  };
  let next = 0;
  const work = async () => {
    while (next < missing.length) {
      const url = missing[next++] as string;
      if (Date.now() > deadline) {
        report.left.push(url);
        continue;
      }
      try {
        const path = photoPath(url);
        const type = photoType(path);
        await to.save(path, await webCopy(await fetchPhoto(url), type), type);
        report.copied.push(url);
        if (report.copied.length % 100 === 0)
          log(`${report.copied.length} of ${missing.length} copied`);
      } catch (error) {
        report.failed.push({ url, error: String(error) });
        log(`${url} wasn't copied: ${error}`);
      }
    }
  };
  await Promise.all(Array.from({ length: workers }, work));
  return report;
}
