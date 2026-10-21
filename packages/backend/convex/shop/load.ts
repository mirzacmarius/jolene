import { v } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import { internalMutation, type MutationCtx } from "../_generated/server";
import {
  choiceValidator,
  lineOptionKindValidator,
  productOptionValidator,
} from "./validators";

/**
 * Brings the categories, order options and fees up to date with the seed's,
 * matched by handle and key, leaving alone those Jolene's team has changed.
 */
export const shelves = internalMutation({
  args: {
    categories: v.array(v.object({ handle: v.string(), title: v.string() })),
    lineOptions: v.array(
      v.object({
        handle: v.string(),
        key: v.string(),
        label: v.string(),
        hint: v.optional(v.string()),
        kind: lineOptionKindValidator,
        required: v.boolean(),
        choices: v.array(choiceValidator),
      }),
    ),
    fees: v.array(
      v.object({ key: v.string(), label: v.string(), price: v.number() }),
    ),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    for (const [position, category] of args.categories.entries()) {
      const existing = await ctx.db
        .query("categories")
        .withIndex("by_handle", (q) => q.eq("handle", category.handle))
        .unique();
      if (!existing)
        await ctx.db.insert("categories", { ...category, position });
      else if (existing.editedAt === undefined)
        await ctx.db.replace("categories", existing._id, {
          ...category,
          position,
        });
    }
    for (const option of args.lineOptions) {
      const existing = await ctx.db
        .query("lineOptions")
        .withIndex("by_handle", (q) => q.eq("handle", option.handle))
        .unique();
      if (!existing) await ctx.db.insert("lineOptions", option);
      else if (existing.editedAt === undefined)
        await ctx.db.replace("lineOptions", existing._id, option);
    }
    for (const fee of args.fees) {
      const existing = await ctx.db
        .query("fees")
        .withIndex("by_key", (q) => q.eq("key", fee.key))
        .unique();
      if (!existing) await ctx.db.insert("fees", fee);
      else if (existing.editedAt === undefined)
        await ctx.db.replace("fees", existing._id, fee);
    }
    return null;
  },
});

/**
 * Creates the seed's products or brings them up to date, matched by handle,
 * leaving alone those Jolene's team has changed. A photo keeps its stored
 * copy while its address stays; a copy whose photo is gone is deleted.
 */
export const products = internalMutation({
  args: {
    products: v.array(
      v.object({
        handle: v.string(),
        title: v.string(),
        descriptionHtml: v.string(),
        price: v.number(),
        compareAtPrice: v.optional(v.number()),
        options: v.array(productOptionValidator),
        lineOptions: v.array(v.string()),
        categories: v.array(v.string()),
        tags: v.array(v.string()),
        images: v.array(v.object({ source: v.string(), alt: v.string() })),
        minQuantity: v.optional(v.number()),
        fees: v.array(v.string()),
        position: v.number(),
      }),
    ),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    for (const product of args.products) {
      const existing = await ctx.db
        .query("products")
        .withIndex("by_handle", (q) => q.eq("handle", product.handle))
        .unique();
      if (existing?.editedAt !== undefined) continue;

      const stored = new Map(
        (existing?.images ?? []).flatMap((image) =>
          image.storageId ? [[image.source, image.storageId] as const] : [],
        ),
      );
      const images: Doc<"products">["images"] = product.images.map((image) => {
        const storageId = stored.get(image.source);
        return storageId ? { ...image, storageId } : image;
      });
      const kept = new Set(images.map((image) => image.storageId));
      for (const storageId of stored.values())
        if (!kept.has(storageId)) await ctx.storage.delete(storageId);

      const doc = {
        ...product,
        images,
        published: existing?.published ?? true,
      };
      const productId = existing?._id ?? (await ctx.db.insert("products", doc));
      if (existing) await ctx.db.replace("products", existing._id, doc);
      await shelve(ctx, productId, doc);
    }
    return null;
  },
});

/**
 * Takes off sale the products the seed no longer lists, unless Jolene's team
 * has changed or added them. They stay in the database, since orders name them.
 */
export const retire = internalMutation({
  args: { handles: v.array(v.string()) },
  returns: v.null(),
  handler: async (ctx, args) => {
    const listed = new Set(args.handles);
    const gone: Doc<"products">[] = [];
    for await (const product of ctx.db
      .query("products")
      .withIndex("by_published_and_position", (q) => q.eq("published", true)))
      if (!listed.has(product.handle) && product.editedAt === undefined)
        gone.push(product);
    for (const product of gone) {
      await ctx.db.patch("products", product._id, { published: false });
      await shelve(ctx, product._id, { ...product, published: false });
    }
    return null;
  },
});

/**
 * Puts a product on its categories' shelves as it now is, and takes it off
 * the others. Whatever changes a product calls it after.
 */
export async function shelve(
  ctx: MutationCtx,
  productId: Id<"products">,
  product: Pick<
    Doc<"products">,
    "categories" | "published" | "position" | "price"
  >,
) {
  const { published, position, price } = product;
  const missing = new Set(product.categories);
  const rows = await ctx.db
    .query("productCategories")
    .withIndex("by_productId", (q) => q.eq("productId", productId))
    .take(100);
  for (const row of rows) {
    if (!missing.delete(row.category))
      await ctx.db.delete("productCategories", row._id);
    else if (
      row.published !== published ||
      row.position !== position ||
      row.price !== price
    )
      await ctx.db.patch("productCategories", row._id, {
        published,
        position,
        price,
      });
  }
  for (const category of missing)
    await ctx.db.insert("productCategories", {
      category,
      productId,
      published,
      position,
      price,
    });
}
