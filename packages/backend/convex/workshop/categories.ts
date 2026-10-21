import { ConvexError, v } from "convex/values";
import type { Doc } from "../_generated/dataModel";
import { mutation, type QueryCtx, query } from "../_generated/server";
import { shopUrl } from "../orders/links";
import { errors } from "../utils/errors";
import { requireWorkshop } from "./staff";

/**
 * The shop's categories in the workshop, at /studio/atelier/categorii: their
 * names, their order, and new ones. A category keeps its address, where
 * jolene.ro's links lead. Saving the list makes every category on it the
 * team's (editedAt), and the seed leaves their names and order alone.
 */

/** The most categories the shop can have: far more than jolene.ro had. */
const MOST_CATEGORIES = 100;

/** The longest name a category can have. */
const TITLE_LENGTH = 100;

/** The longest address a new category gets. */
const HANDLE_LENGTH = 60;

/** The most products a category's count reads: more than any one holds. */
const MOST_COUNTED = 300;

/**
 * Addresses no category can have: the shop's page of all products, and
 * jolene.ro's uncategorized ones, which lead there.
 */
const RESERVED = new Set(["all", "fara-categorie", "uncategorized"]);

/** A category as the workshop's page lists it. */
const shelfValidator = v.object({
  handle: v.string(),
  title: v.string(),
  /** Its products for sale, up to MOST_COUNTED. */
  forSale: v.number(),
  /** Whether it has more for sale than were counted. */
  more: v.boolean(),
  /** Its page in the shop, once the shop's address is set. */
  page: v.union(v.string(), v.null()),
});

/** The shop's categories, in the order its pages list them. */
async function shelves(ctx: QueryCtx) {
  return await ctx.db
    .query("categories")
    .withIndex("by_position")
    .take(MOST_CATEGORIES);
}

/** The list's version: each category's address and name, in order. */
const versionOf = (categories: Doc<"categories">[]) =>
  JSON.stringify(categories.map(({ handle, title }) => [handle, title]));

/** "Mărturii de botez" → "marturii-de-botez": an address from a name. */
export function handleOf(title: string) {
  return title
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .slice(0, HANDLE_LENGTH)
    .replace(/^-+|-+$/g, "");
}

/**
 * An address for a new category, from its name: one no other category has,
 * and no product is on, as one can be on a category the shop has dropped.
 */
async function freeHandle(ctx: QueryCtx, title: string, taken: Set<string>) {
  const base = handleOf(title) || "categorie";
  for (let number = 1; number <= MOST_CATEGORIES + RESERVED.size; number++) {
    const handle = number === 1 ? base : `${base}-${number}`;
    if (taken.has(handle) || RESERVED.has(handle)) continue;
    const shelved = await ctx.db
      .query("productCategories")
      .withIndex("by_category_and_published_and_position", (q) =>
        q.eq("category", handle),
      )
      .first();
    if (!shelved) return handle;
  }
  throw new ConvexError(errors.invalidInput);
}

/**
 * The shop's categories, in its order, each with how many products it has
 * for sale, and the list's version for `save`.
 */
export const list = query({
  args: {},
  returns: v.object({
    categories: v.array(shelfValidator),
    version: v.string(),
    /** When the team last saved the list, and who: null as the seed left it. */
    editedAt: v.union(v.number(), v.null()),
    editedBy: v.union(v.string(), v.null()),
  }),
  handler: async (ctx) => {
    await requireWorkshop(ctx);
    const categories = await shelves(ctx);
    const shop = shopUrl();
    let latest: Doc<"categories"> | undefined;
    for (const category of categories)
      if ((category.editedAt ?? 0) > (latest?.editedAt ?? 0)) latest = category;
    return {
      categories: await Promise.all(
        categories.map(async ({ handle, title }) => {
          const forSale = await ctx.db
            .query("productCategories")
            .withIndex("by_category_and_published_and_position", (q) =>
              q.eq("category", handle).eq("published", true),
            )
            .take(MOST_COUNTED + 1);
          return {
            handle,
            title,
            forSale: Math.min(forSale.length, MOST_COUNTED),
            more: forSale.length > MOST_COUNTED,
            page: shop && `${shop}/collections/${handle}`,
          };
        }),
      ),
      version: versionOf(categories),
      editedAt: latest?.editedAt ?? null,
      editedBy: latest?.editedBy ?? null,
    };
  },
});

/**
 * Saves the shop's categories from the version the workshop's page showed:
 * every one, in their new order, with their names, and new ones, which have
 * no address yet. No two can have the same name. If someone changed the list
 * since, nothing changes (categories-changed), and the page shows theirs.
 */
export const save = mutation({
  args: {
    version: v.string(),
    categories: v.array(
      v.object({
        /** Its address; none for a new one, which gets one from its name. */
        handle: v.optional(v.string()),
        title: v.string(),
      }),
    ),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const by = await requireWorkshop(ctx);
    const categories = await shelves(ctx);
    if (versionOf(categories) !== args.version)
      throw new ConvexError(errors.categoriesChanged);

    const known = new Map(categories.map((shelf) => [shelf.handle, shelf]));
    const saved = args.categories.map(({ handle, title }) => ({
      handle,
      title: title.trim(),
    }));
    const listed = new Set<string>();
    const names = new Set<string>();
    for (const { handle, title } of saved) {
      const name = title.toLocaleLowerCase("ro");
      if (!title || title.length > TITLE_LENGTH || names.has(name))
        throw new ConvexError(errors.invalidInput);
      names.add(name);
      if (handle === undefined) continue;
      if (!known.has(handle) || listed.has(handle))
        throw new ConvexError(errors.invalidInput);
      listed.add(handle);
    }
    // The list moves and renames categories; it takes none away.
    if (listed.size !== categories.length || saved.length > MOST_CATEGORIES)
      throw new ConvexError(errors.invalidInput);
    const unchanged =
      saved.length === categories.length &&
      saved.every(
        ({ handle, title }, index) =>
          handle === categories[index]?.handle &&
          title === categories[index]?.title,
      );
    // Saving nothing new leaves them the seed's, if they were.
    if (unchanged) return null;

    const editedAt = Date.now();
    const taken = new Set(known.keys());
    for (const [position, { handle, title }] of saved.entries()) {
      const shelf = handle === undefined ? undefined : known.get(handle);
      if (shelf) {
        await ctx.db.patch("categories", shelf._id, {
          title,
          position,
          editedAt,
          editedBy: by,
        });
        continue;
      }
      const fresh = await freeHandle(ctx, title, taken);
      taken.add(fresh);
      await ctx.db.insert("categories", {
        handle: fresh,
        title,
        position,
        editedAt,
        editedBy: by,
      });
    }
    return null;
  },
});
