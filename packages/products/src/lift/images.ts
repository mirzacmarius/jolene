import type { ImageLabel, WooImage } from "./woo";

/**
 * Where Shopify fetches an image from: the original, unless it's bigger
 * than Shopify takes (20 MB, 5000 pixels a side, 25 megapixels), then
 * WordPress's copy at most 2560 pixels wide.
 */
export function imageUrl(image: WooImage, label?: ImageLabel): string {
  if (!label) return image.scaled_url;
  const fits =
    label.bytes <= 20_000_000 &&
    Math.max(label.width, label.height) <= 5000 &&
    label.width * label.height <= 25_000_000;
  return fits ? image.url : image.scaled_url;
}
