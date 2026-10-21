import {
  paginationOptsValidator,
  paginationResultValidator,
} from "convex/server";
import { ConvexError, type Infer, v } from "convex/values";
import { internal } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";
import {
  internalMutation,
  mutation,
  type QueryCtx,
  query,
} from "../_generated/server";
import { shopUrl } from "../orders/links";
import { lineOptionView } from "../shop";
import { shelve } from "../shop/load";
import { photoValidator, photoView } from "../shop/photos";
import { loadProduct } from "../shop/pricing";
import {
  lineOptionValidator,
  productOptionValidator,
} from "../shop/validators";
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

/** The most order options the workshop reads: far more than the shop has. */
const LINE_OPTIONS_READ = 500;

/** The most order options one product can ask. */
const MOST_LINE_OPTIONS = 20;

/** The most photos one product can have. */
const MOST_PHOTOS = 20;

/** The longest a photo's description can be. */
const ALT_LENGTH = 200;

/** The kinds of photo the shop shows. */
const PHOTO_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

/**
 * The largest photo the workshop can upload, in bytes. The studio makes the
 * team's photos smaller before they go up, as the photo store's are (ADR 0016).
 */
const PHOTO_BYTES = 10 * 1024 * 1024;

/** How long an uploaded photo waits to be saved on a product. */
const UPLOAD_KEPT = 24 * 60 * 60 * 1000;

/** Uploaded photos one run of `forgetUploads` deletes. */
const UPLOADS_FORGOTTEN = 100;

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
  /** The order options its line asks, in order. */
  lineOptions: v.array(lineOptionValidator),
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
 * Every order option a product can ask, by its name. Several share a name,
 * with other choices or prices, such as jolene.ro's envelope colours.
 */
export const lineOptions = query({
  args: {},
  returns: v.array(lineOptionValidator),
  handler: async (ctx) => {
    await requireWorkshop(ctx);
    const options = await ctx.db.query("lineOptions").take(LINE_OPTIONS_READ);
    return options
      .map(lineOptionView)
      .sort(
        (a, b) =>
          a.label.localeCompare(b.label, "ro") ||
          a.handle.localeCompare(b.handle, "ro", { numeric: true }),
      );
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
    const [titles, images, { lineOptions }] = await Promise.all([
      categoryTitles(ctx),
      Promise.all(product.images.map((image) => photoView(ctx, image))),
      loadProduct(ctx, product),
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
      lineOptions: lineOptions.map(lineOptionView),
      page: shop && `${shop}/products/${product.handle}`,
      editedAt: product.editedAt ?? null,
      editedBy: product.editedBy ?? null,
    };
  },
});

/** Where the workshop uploads a photo for a product (then `photoUploaded`). */
export const photoUploadUrl = mutation({
  args: {},
  returns: v.string(),
  handler: async (ctx) => {
    await requireWorkshop(ctx);
    return await ctx.storage.generateUploadUrl();
  },
});

/**
 * Keeps a photo the workshop just uploaded, for its product's page to save
 * on the product: a JPEG, PNG or WebP of up to 10 MB, or invalid-image. Its
 * address, to show it until then.
 */
export const photoUploaded = mutation({
  args: { storageId: v.id("_storage") },
  returns: v.string(),
  handler: async (ctx, { storageId }) => {
    await requireWorkshop(ctx);
    const file = await ctx.db.system.get("_storage", storageId);
    // A file stored before the upload could be another product's photo.
    if (
      !file ||
      Date.now() - file._creationTime > UPLOAD_KEPT ||
      file.size > PHOTO_BYTES ||
      !PHOTO_TYPES.has(file.contentType ?? "")
    )
      throw new ConvexError(errors.invalidImage);
    const url = await ctx.storage.getUrl(storageId);
    if (!url) throw new ConvexError(errors.invalidImage);
    if (!(await uploadOf(ctx, storageId)))
      await ctx.db.insert("photoUploads", { storageId });
    return url;
  },
});

/** Deletes the photos uploaded a day ago or more that no product took. */
export const forgetUploads = internalMutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const old = await ctx.db
      .query("photoUploads")
      .withIndex("by_creation_time", (q) =>
        q.lt("_creationTime", Date.now() - UPLOAD_KEPT),
      )
      .take(UPLOADS_FORGOTTEN);
    for (const upload of old) {
      if (await ctx.db.system.get("_storage", upload.storageId))
        await ctx.storage.delete(upload.storageId);
      await ctx.db.delete("photoUploads", upload._id);
    }
    if (old.length === UPLOADS_FORGOTTEN)
      await ctx.scheduler.runAfter(
        0,
        internal.workshop.products.forgetUploads,
        {},
      );
    return null;
  },
});

const uploadOf = (ctx: QueryCtx, storageId: Id<"_storage">) =>
  ctx.db
    .query("photoUploads")
    .withIndex("by_storageId", (q) => q.eq("storageId", storageId))
    .unique();

/** A whole number of bani from `least` up to MOST_BANI. */
const isBani = (amount: number, least: number) =>
  Number.isInteger(amount) && amount >= least && amount <= MOST_BANI;

/**
 * A photo as the product's page saves it, with what it shows: one the
 * product had, by its place in the version the page showed, or one uploaded
 * since.
 */
const savedPhotoValidator = v.union(
  v.object({ kept: v.number(), alt: v.string() }),
  v.object({ upload: v.id("_storage"), alt: v.string() }),
);

/**
 * The photos the page saved, as the product keeps them, and the uploads they
 * take; null if one can't be: a place the product hasn't, a photo twice, a
 * file the workshop didn't upload, or a description too long.
 */
async function photosOf(
  ctx: QueryCtx,
  product: Doc<"products">,
  photos: Infer<typeof savedPhotoValidator>[],
) {
  if (photos.length > MOST_PHOTOS) return null;
  const images: Doc<"products">["images"] = [];
  const uploads: Doc<"photoUploads">[] = [];
  const kept = new Set<number>();
  for (const photo of photos) {
    const alt = photo.alt.trim();
    if (alt.length > ALT_LENGTH) return null;
    if ("kept" in photo) {
      const image = product.images[photo.kept];
      if (!Number.isInteger(photo.kept) || !image || kept.has(photo.kept))
        return null;
      kept.add(photo.kept);
      images.push({ ...image, alt });
    } else {
      const upload = await uploadOf(ctx, photo.upload);
      if (!upload || uploads.some(({ _id }) => _id === upload._id)) return null;
      uploads.push(upload);
      // Its address is its stored copy's: it never was on jolene.ro.
      images.push({ source: "", alt, storageId: upload.storageId });
    }
  }
  return { images, uploads };
}

/**
 * The order options the page saved, if the shop has each and no two ask the
 * same, as a line answers each by its key.
 */
async function lineOptionsOf(ctx: QueryCtx, handles: string[]) {
  if (handles.length > MOST_LINE_OPTIONS) return null;
  const options = await Promise.all(
    handles.map((handle) =>
      ctx.db
        .query("lineOptions")
        .withIndex("by_handle", (q) => q.eq("handle", handle))
        .unique(),
    ),
  );
  const keys = new Set(options.map((option) => option?.key));
  if (options.includes(null) || keys.size !== handles.length) return null;
  return handles;
}

/** Whether two lists hold the same, in the same order. */
const sameList = <T>(a: readonly T[], b: readonly T[]) =>
  a.length === b.length && a.every((item, index) => item === b[index]);

/**
 * Changes a product from the version the workshop's page showed: its name,
 * its price and the price before a discount, its minimum order, what each of
 * its papers adds, its photos, its categories, the order options its line
 * asks, and whether it's for sale. If someone changed it since, nothing
 * changes (product-changed), and the page shows their version. A photo the
 * workshop uploaded and the product no longer shows is deleted.
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
    /** Its photos, the first one in lists and the cart. */
    photos: v.array(savedPhotoValidator),
    /** Its categories' handles. */
    categories: v.array(v.string()),
    /** The handles of the order options its line asks, in order. */
    lineOptions: v.array(v.string()),
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
    const { price, compareAtPrice, minQuantity, surcharges, categories } = args;
    const [photos, lineOptions, titles] = await Promise.all([
      photosOf(ctx, product, args.photos),
      lineOptionsOf(ctx, args.lineOptions),
      categoryTitles(ctx),
    ]);
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
      ) ||
      !photos ||
      !lineOptions ||
      new Set(categories).size !== categories.length ||
      // One the shop no longer lists can stay where it is.
      categories.some(
        (category) =>
          !titles.has(category) && !product.categories.includes(category),
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
    const { images, uploads } = photos;
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
      ) &&
      images.length === product.images.length &&
      images.every((image, index) => {
        const was = product.images[index];
        return (
          image.source === was?.source &&
          image.alt === was.alt &&
          image.storageId === was.storageId
        );
      }) &&
      sameList(categories, product.categories) &&
      sameList(lineOptions, product.lineOptions);
    // Saving nothing new leaves it the seed's, if it was.
    if (unchanged) return null;

    const changes = {
      title,
      price,
      compareAtPrice: compareAtPrice ?? undefined,
      minQuantity: minQuantity ?? undefined,
      options,
      images,
      categories,
      lineOptions,
      published: args.published,
      editedAt: Date.now(),
      editedBy: by,
    };
    await ctx.db.patch("products", product._id, changes);
    await shelve(ctx, product._id, { ...product, ...changes });
    // Photos from jolene.ro stay in the photo store; the team's own go.
    const shown = new Set(images.map((image) => image.storageId));
    for (const image of product.images)
      if (image.source === "" && image.storageId && !shown.has(image.storageId))
        await ctx.storage.delete(image.storageId);
    for (const upload of uploads)
      await ctx.db.delete("photoUploads", upload._id);
    return null;
  },
});
