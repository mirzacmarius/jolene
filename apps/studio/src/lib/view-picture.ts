import {
  type DesignDocument,
  type Fields,
  fieldKeysShown,
} from "@jolene/design";

/**
 * What a viewing link's picture is drawn from (docs/adr/0023): the design's
 * revision and the details it shows, which change apart, since the details
 * are the event's. A short hash names the details; two that collide only
 * keep a picture until the next change.
 */
export function pictureKey(
  revision: number,
  document: DesignDocument,
  fields: Fields,
) {
  const shown = JSON.stringify(
    fieldKeysShown(document).map((key) => [key, fields[key] ?? ""]),
  );
  // FNV-1a, 32 bits.
  let hash = 0x811c9dc5;
  for (let i = 0; i < shown.length; i++) {
    hash ^= shown.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return `${revision}:${(hash >>> 0).toString(36)}`;
}
