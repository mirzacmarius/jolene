import { v } from "convex/values";
import type { Doc } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import { photoValidator, photoView } from "../shop/photos";
import { loadProduct, type PricedProduct } from "../shop/pricing";
import { lineOptionKindValidator } from "../shop/validators";
import { choiceLookKindValidator, lookValidator } from "../utils/validators";
import { choiceLook, optionLook, paperLook } from "./looks";

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
 * The template a couple designs a product from in the studio, where they
 * order it (ADR 0021); null for a product the shop's own page orders.
 */
export async function templateOf(
  ctx: QueryCtx,
  handle: string,
): Promise<Doc<"templates"> | null> {
  return await ctx.db
    .query("templates")
    .withIndex("by_shopifyProductHandle_and_retired", (q) =>
      q.eq("shopifyProductHandle", handle).eq("retired", undefined),
    )
    .first();
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

/** How the studio shows a paper or a choice; null when it shows nothing. */
const shownValidator = v.union(lookValidator, v.null());

/**
 * A template's product as the studio asks its order: what one costs, its
 * minimum order, its papers and the order options its line asks, each paper
 * and choice with what it adds, in bani, and its look (ADR 0021).
 */
export const orderedProductValidator = v.object({
  handle: v.string(),
  title: v.string(),
  /** Each one, before its paper's surcharge and its paid choices. */
  price: v.number(),
  compareAtPrice: v.optional(v.number()),
  minQuantity: v.optional(v.number()),
  /** Its papers: the couple picks one value of each. */
  options: v.array(
    v.object({
      name: v.string(),
      values: v.array(
        v.object({
          name: v.string(),
          surcharge: v.number(),
          look: shownValidator,
        }),
      ),
    }),
  ),
  lineOptions: v.array(
    v.object({
      key: v.string(),
      label: v.string(),
      hint: v.optional(v.string()),
      kind: lineOptionKindValidator,
      required: v.boolean(),
      /** What its choices change in a design; null for one asked in words. */
      shows: v.union(choiceLookKindValidator, v.null()),
      choices: v.array(
        v.object({
          label: v.string(),
          price: v.number(),
          look: shownValidator,
        }),
      ),
    }),
  ),
});

/** A product as the studio asks its order, summed up above. */
export async function orderedProduct(ctx: QueryCtx, product: Doc<"products">) {
  const { lineOptions } = await loadProduct(ctx, product);
  return {
    handle: product.handle,
    title: product.title,
    price: product.price,
    compareAtPrice: product.compareAtPrice,
    minQuantity: product.minQuantity,
    options: product.options.map(({ name, values }) => ({
      name,
      values: values.map((value) => ({
        name: value.name,
        surcharge: value.surcharge,
        look: paperLook(value.name),
      })),
    })),
    lineOptions: lineOptions.map((option) => ({
      key: option.key,
      label: option.label,
      hint: option.hint,
      kind: option.kind,
      required: option.required,
      shows: optionLook(option.key),
      choices: option.choices.map((choice) => ({
        label: choice.label,
        price: choice.price,
        look: choiceLook(option.key, choice),
      })),
    })),
  };
}
