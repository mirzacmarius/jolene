import {
  paginationOptsValidator,
  paginationResultValidator,
} from "convex/server";
import { v } from "convex/values";
import type { Doc } from "./_generated/dataModel";
import { type QueryCtx, query } from "./_generated/server";
import { photoValidator, photoView } from "./shop/photos";
import { loadProduct } from "./shop/pricing";
import { lineOptionValidator, productOptionValidator } from "./shop/validators";

const categoryValidator = v.object({ handle: v.string(), title: v.string() });

/** A category as the shop's list of them shows it, with a photo. */
const shelfValidator = v.object({
  ...categoryValidator.fields,
  image: v.union(photoValidator, v.null()),
});

/** What a list of products shows of each: its first two photos, for hover. */
const cardValidator = v.object({
  handle: v.string(),
  title: v.string(),
  price: v.number(),
  compareAtPrice: v.optional(v.number()),
  minQuantity: v.optional(v.number()),
  images: v.array(photoValidator),
});

const productValidator = v.object({
  handle: v.string(),
  title: v.string(),
  descriptionHtml: v.string(),
  price: v.number(),
  compareAtPrice: v.optional(v.number()),
  minQuantity: v.optional(v.number()),
  images: v.array(photoValidator),
  options: v.array(productOptionValidator),
  lineOptions: v.array(lineOptionValidator),
  fees: v.array(
    v.object({
      key: v.string(),
      label: v.string(),
      description: v.optional(v.string()),
      price: v.number(),
    }),
  ),
  categories: v.array(categoryValidator),
  tags: v.array(v.string()),
  /** Bought for one of a couple's events, which its page shows. */
  forEvent: v.boolean(),
});

/** The orders a list can come in: Jolene's, or by price. */
const sortValidator = v.union(
  v.literal("position"),
  v.literal("price-ascending"),
  v.literal("price-descending"),
);

const cardView = async (ctx: QueryCtx, product: Doc<"products">) => ({
  handle: product.handle,
  title: product.title,
  price: product.price,
  compareAtPrice: product.compareAtPrice,
  minQuantity: product.minQuantity,
  images: await Promise.all(
    product.images.slice(0, 2).map((image) => photoView(ctx, image)),
  ),
});

const categoryView = ({ handle, title }: Doc<"categories">) => ({
  handle,
  title,
});

export const lineOptionView = ({
  handle,
  key,
  label,
  hint,
  kind,
  required,
  choices,
}: Doc<"lineOptions">) => ({
  handle,
  key,
  label,
  hint,
  kind,
  required,
  choices,
});

const feeView = ({ key, label, description, price }: Doc<"fees">) => ({
  key,
  label,
  description,
  price,
});

/**
 * A product on sale, with its photos, its papers, the order options its line
 * asks and the fees an order of it can carry; or null. Prices are in bani.
 */
export const product = query({
  args: { handle: v.string() },
  returns: v.union(productValidator, v.null()),
  handler: async (ctx, { handle }) => {
    const product = await ctx.db
      .query("products")
      .withIndex("by_handle", (q) => q.eq("handle", handle))
      .unique();
    if (!product?.published) return null;
    const [images, { lineOptions, fees }, categories] = await Promise.all([
      Promise.all(product.images.map((image) => photoView(ctx, image))),
      loadProduct(ctx, product),
      Promise.all(
        product.categories.map((category) =>
          ctx.db
            .query("categories")
            .withIndex("by_handle", (q) => q.eq("handle", category))
            .unique(),
        ),
      ),
    ]);
    return {
      handle: product.handle,
      title: product.title,
      descriptionHtml: product.descriptionHtml,
      price: product.price,
      compareAtPrice: product.compareAtPrice,
      minQuantity: product.minQuantity,
      images,
      options: product.options,
      lineOptions: lineOptions.map(lineOptionView),
      fees: fees.map(feeView),
      categories: categories.flatMap((category) =>
        category ? [categoryView(category)] : [],
      ),
      tags: product.tags,
      forEvent: product.forEvent === true,
    };
  },
});

/**
 * The products on sale, a page at a time: a category's, or all of them, in
 * Jolene's order or by price. Those bought for an event aren't on any list.
 */
export const products = query({
  args: {
    category: v.optional(v.string()),
    sort: v.optional(sortValidator),
    paginationOpts: paginationOptsValidator,
  },
  returns: paginationResultValidator(cardValidator),
  handler: async (ctx, { category, sort = "position", paginationOpts }) => {
    const order = sort === "price-descending" ? "desc" : "asc";
    if (category === undefined) {
      const result = await (sort === "position"
        ? ctx.db
            .query("products")
            .withIndex("by_published_and_forEvent_and_position", (q) =>
              q.eq("published", true).eq("forEvent", undefined),
            )
        : ctx.db
            .query("products")
            .withIndex("by_published_and_forEvent_and_price", (q) =>
              q.eq("published", true).eq("forEvent", undefined),
            )
      )
        .order(order)
        .paginate(paginationOpts);
      return {
        ...result,
        page: await Promise.all(result.page.map((p) => cardView(ctx, p))),
      };
    }
    const result = await (sort === "position"
      ? ctx.db
          .query("productCategories")
          .withIndex("by_category_and_published_and_position", (q) =>
            q.eq("category", category).eq("published", true),
          )
      : ctx.db
          .query("productCategories")
          .withIndex("by_category_and_published_and_price", (q) =>
            q.eq("category", category).eq("published", true),
          )
    )
      .order(order)
      .paginate(paginationOpts);
    const products = await Promise.all(
      result.page.map((row) => ctx.db.get("products", row.productId)),
    );
    return {
      ...result,
      page: await Promise.all(
        products.flatMap((p) => (p ? [cardView(ctx, p)] : [])),
      ),
    };
  },
});

/**
 * The products on sale whose names match what a visitor typed, best first,
 * leaving out those bought for an event.
 */
export const search = query({
  args: { query: v.string(), limit: v.optional(v.number()) },
  returns: v.array(cardValidator),
  handler: async (ctx, args) => {
    const limit = Math.min(Math.max(Math.floor(args.limit ?? 24), 1), 100);
    const found = await ctx.db
      .query("products")
      .withSearchIndex("search_title", (q) =>
        q
          .search("title", args.query)
          .eq("published", true)
          .eq("forEvent", undefined),
      )
      .take(limit);
    return Promise.all(found.map((p) => cardView(ctx, p)));
  },
});

/**
 * The shop's categories, in the order its menu lists them, each with the
 * first photo of the first product it shows.
 */
export const categories = query({
  args: {},
  returns: v.array(shelfValidator),
  handler: async (ctx) => {
    const categories = await ctx.db
      .query("categories")
      .withIndex("by_position")
      .take(200);
    return Promise.all(
      categories.map(async (category) => {
        const first = await ctx.db
          .query("productCategories")
          .withIndex("by_category_and_published_and_position", (q) =>
            q.eq("category", category.handle).eq("published", true),
          )
          .first();
        const product =
          first && (await ctx.db.get("products", first.productId));
        const image = product?.images[0];
        return {
          ...categoryView(category),
          image: image ? await photoView(ctx, image) : null,
        };
      }),
    );
  },
});

/** One category, or null. */
export const category = query({
  args: { handle: v.string() },
  returns: v.union(categoryValidator, v.null()),
  handler: async (ctx, { handle }) => {
    const category = await ctx.db
      .query("categories")
      .withIndex("by_handle", (q) => q.eq("handle", handle))
      .unique();
    return category && categoryView(category);
  },
});
