import { assetKeys, type DesignDocument } from "@jolene/design";
import { v } from "convex/values";
import type { Doc } from "./_generated/dataModel";
import { type QueryCtx, query } from "./_generated/server";
import {
  orderedProduct,
  orderedProductValidator,
  productOf,
  productSummary,
  productSummaryValidator,
} from "./catalog/products";
import { COURIER_PRICE, FREE_DELIVERY_FROM } from "./checkout/delivery";
import { resolveAssets, resolvedAssetValidator } from "./utils/assets";
import {
  documentValidator,
  fieldsValidator,
  labelsValidator,
  occasionValidator,
  productKindValidator,
} from "./utils/validators";

const suiteValidator = v.object({
  _id: v.id("suites"),
  slug: v.string(),
  name: labelsValidator,
  description: labelsValidator,
  occasion: occasionValidator,
  styles: v.array(v.string()),
  sampleFields: fieldsValidator,
});

const templateValidator = v.object({
  _id: v.id("templates"),
  slug: v.string(),
  kind: productKindValidator,
  document: documentValidator,
});

/** A template with the product it's ordered as, while that's for sale. */
const offerValidator = v.object({
  ...templateValidator.fields,
  product: v.union(productSummaryValidator, v.null()),
});

const suiteView = ({
  _id,
  slug,
  name,
  description,
  occasion,
  styles,
  sampleFields,
}: Doc<"suites">) => ({
  _id,
  slug,
  name,
  description,
  occasion,
  styles,
  sampleFields,
});

const templateView = ({ _id, slug, kind, document }: Doc<"templates">) => ({
  _id,
  slug,
  kind,
  document,
});

/** A template with its product and up to `photos` of the product's photos. */
const offerView = async (
  ctx: QueryCtx,
  template: Doc<"templates">,
  { photos }: { photos: number },
) => {
  const product = await productOf(ctx, template);
  return {
    ...templateView(template),
    product: product ? await productSummary(ctx, product, { photos }) : null,
  };
};

/** Stored documents were checked against the design schema when saved. */
const keysOf = (templates: { document: unknown }[]) =>
  templates.flatMap((template) =>
    assetKeys(template.document as DesignDocument),
  );

/**
 * The published suites in the order Jolene sets, each with its lead item (the
 * invitation, usually) to preview it by and the first photo of its product,
 * and the files those previews draw.
 */
export const suites = query({
  args: {},
  returns: v.object({
    suites: v.array(
      v.object({
        ...suiteValidator.fields,
        lead: v.union(offerValidator, v.null()),
      }),
    ),
    assets: v.array(resolvedAssetValidator),
  }),
  handler: async (ctx) => {
    const published = await ctx.db
      .query("suites")
      .withIndex("by_published_and_sortOrder", (q) => q.eq("published", true))
      .take(200);
    const suites = await Promise.all(
      published.map(async (suite) => {
        const lead = await ctx.db
          .query("templates")
          .withIndex("by_suiteId_and_retired_and_sortOrder", (q) =>
            q.eq("suiteId", suite._id).eq("retired", undefined),
          )
          .first();
        return {
          ...suiteView(suite),
          lead: lead ? await offerView(ctx, lead, { photos: 1 }) : null,
        };
      }),
    );
    const leads = suites.flatMap((suite) => (suite.lead ? [suite.lead] : []));
    return {
      suites,
      assets: await resolveAssets(ctx, keysOf(leads), null),
    };
  },
});

/**
 * One published suite with every item it offers, each with its product's
 * photos and price, and what delivery costs; or null.
 */
export const suite = query({
  args: { slug: v.string() },
  returns: v.union(
    v.object({
      suite: suiteValidator,
      templates: v.array(offerValidator),
      assets: v.array(resolvedAssetValidator),
      /** In bani: the courier, and the order from which it's free. */
      delivery: v.object({ courier: v.number(), freeFrom: v.number() }),
    }),
    v.null(),
  ),
  handler: async (ctx, { slug }) => {
    const suite = await ctx.db
      .query("suites")
      .withIndex("by_slug", (q) => q.eq("slug", slug))
      .unique();
    if (!suite?.published) return null;
    const templates = await Promise.all(
      (
        await ctx.db
          .query("templates")
          .withIndex("by_suiteId_and_retired_and_sortOrder", (q) =>
            q.eq("suiteId", suite._id).eq("retired", undefined),
          )
          .take(24)
      ).map((template) => offerView(ctx, template, { photos: 12 })),
    );
    return {
      suite: suiteView(suite),
      templates,
      assets: await resolveAssets(ctx, keysOf(templates), null),
      delivery: { courier: COURIER_PRICE, freeFrom: FREE_DELIVERY_FROM },
    };
  },
});

/**
 * The product a template's designs are ordered as, while it's for sale: its
 * price and minimum order, its papers and the order options its line asks,
 * with how the studio shows each (ADR 0021). Null for one the shop doesn't
 * sell.
 */
export const product = query({
  args: { template: v.string() },
  returns: v.union(orderedProductValidator, v.null()),
  handler: async (ctx, { template: slug }) => {
    const template = await ctx.db
      .query("templates")
      .withIndex("by_slug", (q) => q.eq("slug", slug))
      .unique();
    if (!template) return null;
    const product = await productOf(ctx, template);
    return product ? await orderedProduct(ctx, product) : null;
  },
});

/**
 * The artwork a published suite's items draw, each file once, in the order
 * its items use them: what expert mode offers to swap a picture for. Photos
 * are the couple's own and never listed.
 */
export const artwork = query({
  args: { slug: v.string() },
  returns: v.array(
    v.object({
      key: v.string(),
      name: v.union(v.string(), v.null()),
      url: v.string(),
      recolorable: v.boolean(),
    }),
  ),
  handler: async (ctx, { slug }) => {
    const suite = await ctx.db
      .query("suites")
      .withIndex("by_slug", (q) => q.eq("slug", slug))
      .unique();
    if (!suite?.published) return [];
    const templates = await ctx.db
      .query("templates")
      .withIndex("by_suiteId_and_retired_and_sortOrder", (q) =>
        q.eq("suiteId", suite._id).eq("retired", undefined),
      )
      .take(24);
    const listed = [];
    for (const key of new Set(keysOf(templates))) {
      const asset = await ctx.db
        .query("assets")
        .withIndex("by_key", (q) => q.eq("key", key))
        .unique();
      if (asset?.kind !== "artwork") continue;
      const url =
        asset.path ??
        (asset.storageId ? await ctx.storage.getUrl(asset.storageId) : null);
      if (!url) continue;
      listed.push({
        key,
        name: asset.name ?? null,
        url,
        recolorable: asset.recolorable,
      });
    }
    return listed;
  },
});
