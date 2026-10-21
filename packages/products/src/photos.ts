/**
 * Where the shop shows the catalog's photos from (ADR 0016). They're copied
 * from jolene.ro to the photo store, one public Vercel Blob store that
 * production, every preview and every developer's deployment share, each
 * under the path it had in jolene.ro's uploads.
 */

/** Where jolene.ro kept the photos the lift took. */
const uploads = "https://jolene.ro/wp-content/uploads/";

/** The photo store's folder for the photos copied from jolene.ro. */
export const photoFolder = "jolene.ro/";

/**
 * The photo store's address once the catalog's photos are in it: until
 * then, the shop shows them from jolene.ro.
 */
export const photoStore: string | undefined = undefined;

/** A jolene.ro photo's path in the photo store: jolene.ro/2021/10/a.jpg. */
export function photoPath(url: string): string {
  if (!url.startsWith(uploads))
    throw new Error(`${url} isn't one of jolene.ro's photos`);
  return photoFolder + url.slice(uploads.length);
}

/** Where the shop shows a photo of the catalog from. */
export function photoUrl(url: string): string {
  return photoStore ? `${photoStore}/${photoPath(url)}` : url;
}
