/**
 * The type of a picture a browser sent as bytes, from its first bytes: the
 * studio draws its pictures as PNG or JPEG, and nothing else is stored.
 */
export function imageType(
  bytes: ArrayBuffer,
): "image/png" | "image/jpeg" | null {
  const [a, b, c, d] = new Uint8Array(bytes.slice(0, 4));
  if (a === 0x89 && b === 0x50 && c === 0x4e && d === 0x47) return "image/png";
  if (a === 0xff && b === 0xd8 && c === 0xff) return "image/jpeg";
  return null;
}
