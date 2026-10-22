import { v } from "convex/values";
import type { Doc } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import { photoValidator, photoView } from "../shop/photos";
import { loadProduct, type PricedProduct } from "../shop/pricing";

/**
 * A template's product as the studio's collections show it: what one costs
 * at the least, the minimum order and Jolene's photos of it, the first
 * leading.
 */
export const productSummaryValidator = v.object({
  handle: v.string(),
  /** The least one costs, in bani: with its cheapest paper and choices. */
  price: v.number(),
  /** Whether a paper or an order option can make one cost more. */
  varies: v.boolean(),
  minQuantity: v.optional(v.number()),
  photos: v.array(photoValidator),
});

/** The shop's product a template is ordered as, while it's for sale. */
export async function productOf(
  ctx: QueryCtx,
  template: Doc<"templates">,
): Promise<Doc<"products"> | null> {
  const handle = template.shopifyProductHandle;
  if (handle === undefined) return null;
  const product = await ctx.db
    .query("products")
    .withIndex("by_handle", (q) => q.eq("handle", handle))
    .unique();
  return product?.published ? product : null;
}

/**
 * The least and the most one of a product can cost, in bani: every paper
 * must be picked, an order option only when it's required.
 */
export function priceRange({ product, lineOptions }: PricedProduct) {
  let least = product.price;
  let most = product.price;
  for (const option of product.options) {
    const surcharges = option.values.map((value) => value.surcharge);
    if (surcharges.length === 0) continue;
    least += Math.min(...surcharges);
    most += Math.max(...surcharges);
  }
  for (const option of lineOptions) {
    if (option.kind !== "select" || option.choices.length === 0) continue;
    const prices = option.choices.map((choice) => choice.price);
    if (option.required) least += Math.min(...prices);
    most += Math.max(0, ...prices);
  }
  return { least, most };
}

/** A product as summed up above, with up to `photos` of its photos. */
export async function productSummary(
  ctx: QueryCtx,
  product: Doc<"products">,
  { photos }: { photos: number },
) {
  const { least, most } = priceRange(await loadProduct(ctx, product));
  return {
    handle: product.handle,
    price: least,
    varies: most > least,
    minQuantity: product.minQuantity,
    photos: await Promise.all(
      product.images.slice(0, photos).map((image) => photoView(ctx, image)),
    ),
  };
}
