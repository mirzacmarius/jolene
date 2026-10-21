import {
  paginationOptsValidator,
  paginationResultValidator,
} from "convex/server";
import { ConvexError, v } from "convex/values";
import type { Doc } from "../_generated/dataModel";
import { mutation, type QueryCtx, query } from "../_generated/server";
import { shopUrl } from "../orders/links";
import { shelve } from "../shop/load";
import { photoValidator, photoView } from "../shop/photos";
import { productOptionValidator } from "../shop/validators";
import { errors } from "../utils/errors";
import { requireWorkshop } from "./staff";

/**
 * The shop's products in the workshop, at /studio/atelier/produse: every one,
 * for sale or not, and what the team changes on them. A product the team has
 * changed is theirs from then on (editedAt), and the seed leaves it alone.
 */

/** The longest name a product can have. */
const TITLE_LENGTH = 200;

/** The most a price or a surcharge can be, in bani: 100.000 lei. */
const MOST_BANI = 10_000_000;

/** The largest minimum order, in pieces. */
const MOST_PIECES = 10_000;

/** The most categories the workshop reads: far more than the shop has. */
const CATEGORIES_READ = 200;

const categoryValidator = v.object({ handle: v.string(), title: v.string() });

/** A product as the workshop's list shows it. */
const productRowValidator = v.object({
  handle: v.string(),
  title: v.string(),
  price: v.number(),
  compareAtPrice: v.optional(v.number()),
  minQuantity: v.optional(v.number()),
  published: v.boolean(),
  forEvent: v.boolean(),
  /** Its first photo. */
  image: v.union(photoValidator, v.null()),
  /** Its categories' names. */
  categories: v.array(v.string()),
  /** When the team last changed it; never, as the seed left it. */
  editedAt: v.optional(v.number()),
});

/** A product with all the workshop can change on it. */
const workshopProductValidator = v.object({
  handle: v.string(),
  title: v.string(),
  price: v.number(),
  compareAtPrice: v.optional(v.number()),
  minQuantity: v.optional(v.number()),
  published: v.boolean(),
  forEvent: v.boolean(),
  /** Its papers and its other options, each value with its surcharge. */
  options: v.array(productOptionValidator),
  images: v.array(photoValidator),
  categories: v.array(categoryValidator),
  /** Its page in the shop, once the shop's address is set. */
  page: v.union(v.string(), v.null()),
  /** When the team last changed it, and who: null as the seed left it. */
  editedAt: v.union(v.number(), v.null()),
  editedBy: v.union(v.string(), v.null()),
});

/** Each category's name, by its handle. */
async function categoryTitles(ctx: QueryCtx) {
  const categories = await ctx.db
    .query("categories")
    .withIndex("by_position")
    .take(CATEGORIES_READ);
  return new Map(categories.map(({ handle, title }) => [handle, title]));
}

async function productByHandle(ctx: QueryCtx, handle: string) {
  return await ctx.db
    .query("products")
    .withIndex("by_handle", (q) => q.eq("handle", handle))
    .unique();
}

async function rowOf(
  ctx: QueryCtx,
  product: Doc<"products">,
  titles: Map<string, string>,
) {
  const image = product.images[0];
  return {
    handle: product.handle,
    title: product.title,
    price: product.price,
    compareAtPrice: product.compareAtPrice,
    minQuantity: product.minQuantity,
    published: product.published,
    forEvent: product.forEvent === true,
    image: image ? await photoView(ctx, image) : null,
    categories: product.categories.flatMap((handle) => {
      const title = titles.get(handle);
      return title ? [title] : [];
    }),
    editedAt: product.editedAt,
  };
}

/** The shop's categories, in the order its menu lists them. */
export const categories = query({
  args: {},
  returns: v.array(categoryValidator),
  handler: async (ctx) => {
    await requireWorkshop(ctx);
    return [...(await categoryTitles(ctx))].map(([handle, title]) => ({
      handle,
      title,
    }));
  },
});

/**
 * The products for sale, or those taken off sale, a page at a time: in
 * Jolene's order, all of them or a category's; or, for words of a name, the
 * best matches first, in every category.
 */
export const list = query({
  args: {
    paginationOpts: paginationOptsValidator,
    published: v.boolean(),
    category: v.optional(v.string()),
    search: v.optional(v.string()),
  },
  returns: paginationResultValidator(productRowValidator),
  handler: async (ctx, { paginationOpts, published, category, search }) => {
    await requireWorkshop(ctx);
    const titles = await categoryTitles(ctx);
    const words = search?.trim();
    if (words) {
      const found = await ctx.db
        .query("products")
        .withSearchIndex("search_title", (q) =>
          q.search("title", words).eq("published", published),
        )
        .paginate(paginationOpts);
      return {
        ...found,
        page: await Promise.all(
          found.page.map((product) => rowOf(ctx, product, titles)),
        ),
      };
    }
    if (category) {
      const shelf = await ctx.db
        .query("productCategories")
        .withIndex("by_category_and_published_and_position", (q) =>
          q.eq("category", category).eq("published", published),
        )
        .paginate(paginationOpts);
      const products = await Promise.all(
        shelf.page.map((row) => ctx.db.get("products", row.productId)),
      );
      return {
        ...shelf,
        page: await Promise.all(
          products.flatMap((product) =>
            product ? [rowOf(ctx, product, titles)] : [],
          ),
        ),
      };
    }
    // Those bought for an event come last, as the index orders them.
    const all = await ctx.db
      .query("products")
      .withIndex("by_published_and_forEvent_and_position", (q) =>
        q.eq("published", published),
      )
      .paginate(paginationOpts);
    return {
      ...all,
      page: await Promise.all(
        all.page.map((product) => rowOf(ctx, product, titles)),
      ),
    };
  },
});

/** One product, all the workshop can change on it; null for an unknown one. */
export const product = query({
  args: { handle: v.string() },
  returns: v.union(workshopProductValidator, v.null()),
  handler: async (ctx, { handle }) => {
    await requireWorkshop(ctx);
    const product = await productByHandle(ctx, handle);
    if (!product) return null;
    const [titles, images] = await Promise.all([
      categoryTitles(ctx),
      Promise.all(product.images.map((image) => photoView(ctx, image))),
    ]);
    const shop = shopUrl();
    return {
      handle: product.handle,
      title: product.title,
      price: product.price,
      compareAtPrice: product.compareAtPrice,
      minQuantity: product.minQuantity,
      published: product.published,
      forEvent: product.forEvent === true,
      options: product.options,
      images,
      categories: product.categories.map((category) => ({
        handle: category,
        title: titles.get(category) ?? category,
      })),
      page: shop && `${shop}/products/${product.handle}`,
      editedAt: product.editedAt ?? null,
      editedBy: product.editedBy ?? null,
    };
  },
});

/** A whole number of bani from `least` up to MOST_BANI. */
const isBani = (amount: number, least: number) =>
  Number.isInteger(amount) && amount >= least && amount <= MOST_BANI;

/**
 * Changes a product from the version the workshop's page showed: its name,
 * its price and the price before a discount, its minimum order, what each of
 * its papers adds, and whether it's for sale. If someone changed it since,
 * nothing changes (product-changed), and the page shows their version.
 */
export const save = mutation({
  args: {
    handle: v.string(),
    /** When the product was last changed, as the page showed it; null if never. */
    editedAt: v.union(v.number(), v.null()),
    title: v.string(),
    /** Each one, in bani. */
    price: v.number(),
    /** The price before a discount, higher than the price; null for none. */
    compareAtPrice: v.union(v.number(), v.null()),
    minQuantity: v.union(v.number(), v.null()),
    /** Each option's values' surcharges, in bani, in the order they're listed. */
    surcharges: v.array(v.array(v.number())),
    published: v.boolean(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const by = await requireWorkshop(ctx);
    const product = await productByHandle(ctx, args.handle);
    if (!product) throw new ConvexError(errors.notFound);
    if ((product.editedAt ?? null) !== args.editedAt)
      throw new ConvexError(errors.productChanged);

    const title = args.title.trim();
    const { price, compareAtPrice, minQuantity, surcharges } = args;
    if (
      !title ||
      title.length > TITLE_LENGTH ||
      !isBani(price, 1) ||
      (compareAtPrice !== null &&
        (!isBani(compareAtPrice, 1) || compareAtPrice <= price)) ||
      (minQuantity !== null &&
        (!Number.isInteger(minQuantity) ||
          minQuantity < 1 ||
          minQuantity > MOST_PIECES)) ||
      surcharges.length !== product.options.length ||
      product.options.some(
        (option, index) =>
          surcharges[index]?.length !== option.values.length ||
          surcharges[index].some((surcharge) => !isBani(surcharge, 0)),
      )
    )
      throw new ConvexError(errors.invalidInput);

    const options = product.options.map((option, index) => ({
      ...option,
      values: option.values.map((value, place) => ({
        ...value,
        surcharge: surcharges[index]?.[place] ?? value.surcharge,
      })),
    }));
    const unchanged =
      title === product.title &&
      price === product.price &&
      compareAtPrice === (product.compareAtPrice ?? null) &&
      minQuantity === (product.minQuantity ?? null) &&
      args.published === product.published &&
      options.every((option, index) =>
        option.values.every(
          (value, place) =>
            value.surcharge ===
            product.options[index]?.values[place]?.surcharge,
        ),
      );
    // Saving nothing new leaves it the seed's, if it was.
    if (unchanged) return null;

    const changes = {
      title,
      price,
      compareAtPrice: compareAtPrice ?? undefined,
      minQuantity: minQuantity ?? undefined,
      options,
      published: args.published,
      editedAt: Date.now(),
      editedBy: by,
    };
    await ctx.db.patch("products", product._id, changes);
    await shelve(ctx, product._id, { ...product, ...changes });
    return null;
  },
});
