import {
  paginationOptsValidator,
  paginationResultValidator,
} from "convex/server";
import { v } from "convex/values";
import type { Doc } from "./_generated/dataModel";
import { type QueryCtx, query } from "./_generated/server";
import {
  choiceValidator,
  lineOptionKindValidator,
  productOptionValidator,
} from "./shop/validators";

/** A photo as the shop shows it: from storage once copied there. */
const photoValidator = v.object({ url: v.string(), alt: v.string() });

const categoryValidator = v.object({ handle: v.string(), title: v.string() });

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
  categories: v.array(categoryValidator),
  tags: v.array(v.string()),
});

/** The orders a list can come in: Jolene's, or by price. */
const sortValidator = v.union(
  v.literal("position"),
  v.literal("price-ascending"),
  v.literal("price-descending"),
);

const photoView = async (
  ctx: QueryCtx,
  { source, alt, storageId }: Doc<"products">["images"][number],
) => ({
  url: (storageId && (await ctx.storage.getUrl(storageId))) || source,
  alt,
});

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

const lineOptionView = ({
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

const feeView = ({ key, label, price }: Doc<"fees">) => ({ key, label, price });

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
    const [images, lineOptions, fees, categories] = await Promise.all([
      Promise.all(product.images.map((image) => photoView(ctx, image))),
      Promise.all(
        product.lineOptions.map((option) =>
          ctx.db
            .query("lineOptions")
            .withIndex("by_handle", (q) => q.eq("handle", option))
            .unique(),
        ),
      ),
      Promise.all(
        product.fees.map((fee) =>
          ctx.db
            .query("fees")
            .withIndex("by_key", (q) => q.eq("key", fee))
            .unique(),
        ),
      ),
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
      lineOptions: lineOptions.flatMap((option) =>
        option ? [lineOptionView(option)] : [],
      ),
      fees: fees.flatMap((fee) => (fee ? [feeView(fee)] : [])),
      categories: categories.flatMap((category) =>
        category ? [categoryView(category)] : [],
      ),
      tags: product.tags,
    };
  },
});

/**
 * The products on sale, a page at a time: a category's, or all of them, in
 * Jolene's order or by price.
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
            .withIndex("by_published_and_position", (q) =>
              q.eq("published", true),
            )
        : ctx.db
            .query("products")
            .withIndex("by_published_and_price", (q) => q.eq("published", true))
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

/** The products on sale whose names match what a visitor typed, best first. */
export const search = query({
  args: { query: v.string(), limit: v.optional(v.number()) },
  returns: v.array(cardValidator),
  handler: async (ctx, args) => {
    const limit = Math.min(Math.max(Math.floor(args.limit ?? 24), 1), 100);
    const found = await ctx.db
      .query("products")
      .withSearchIndex("search_title", (q) =>
        q.search("title", args.query).eq("published", true),
      )
      .take(limit);
    return Promise.all(found.map((p) => cardView(ctx, p)));
  },
});

/** The shop's categories, in the order its menu lists them. */
export const categories = query({
  args: {},
  returns: v.array(categoryValidator),
  handler: async (ctx) =>
    (await ctx.db.query("categories").withIndex("by_position").take(200)).map(
      categoryView,
    ),
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
