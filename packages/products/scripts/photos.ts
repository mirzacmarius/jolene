/**
 * Copies the catalog's and the blog's photos from jolene.ro to the photo
 * store (ADR 0016), fit for the web, leaving those it already has:
 *
 *   bun scripts/photos.ts [--to folder] [--minutes n]
 *
 * The store is the Vercel Blob store connected to the shop's project, whose
 * production builds run this after building. --to copies into a folder
 * instead, to look at the copies. --minutes stops starting copies after so
 * long; the next run copies the rest.
 */
import { parseArgs } from "node:util";
import { blogPhotos } from "../src/blog";
import { catalog } from "../src/data";
import { blobStore, copyPhotos, folder } from "../src/photo-store";

const { values } = parseArgs({
  options: { to: { type: "string" }, minutes: { type: "string" } },
});
const destination = values.to ? folder(values.to) : blobStore();
const started = Date.now();
const urls = new Set([
  ...catalog.products.flatMap((product) =>
    product.images.map(({ url }) => url),
  ),
  ...blogPhotos(),
]);
const report = await copyPhotos(urls, destination, {
  deadline: values.minutes
    ? started + Number(values.minutes) * 60_000
    : Number.POSITIVE_INFINITY,
  log: console.log,
});

const seconds = Math.round((Date.now() - started) / 1000);
console.log(
  [
    `${report.had + report.copied.length} of the catalog's and the blog's ${urls.size} photos are in ${destination.address() ?? "the photo store"}`,
    `${report.copied.length} copied now, in ${seconds} s`,
    ...(report.failed.length ? [`${report.failed.length} failed`] : []),
    ...(report.left.length
      ? [`${report.left.length} left for the next run`]
      : []),
  ].join("; "),
);
if (report.failed.length) process.exitCode = 1;
