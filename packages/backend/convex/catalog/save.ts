import { documentSchema } from "@jolene/design";
import { ConvexError, type Infer, v } from "convex/values";
import { z } from "zod";
import { internalMutation, type MutationCtx } from "../_generated/server";
import {
  documentValidator,
  fieldsValidator,
  labelsValidator,
  occasionValidator,
} from "../utils/validators";

const assetValidator = v.object({
  key: v.string(),
  /** An uploaded file; or `path`, for a file the studio serves. */
  storageId: v.optional(v.id("_storage")),
  path: v.optional(v.string()),
  kind: v.union(v.literal("artwork"), v.literal("photo"), v.literal("texture")),
  contentType: v.string(),
  recolorable: v.boolean(),
  name: v.optional(v.string()),
});

/** Puts a file behind an asset key, deleting the upload it replaces. */
async function saveAsset(
  ctx: MutationCtx,
  asset: Infer<typeof assetValidator>,
) {
  if ((asset.storageId === undefined) === (asset.path === undefined))
    throw new ConvexError(`${asset.key}: give a storageId or a path`);
  const existing = await ctx.db
    .query("assets")
    .withIndex("by_key", (q) => q.eq("key", asset.key))
    .unique();
  if (!existing) {
    await ctx.db.insert("assets", asset);
    return;
  }
  if (existing.storageId && existing.storageId !== asset.storageId)
    await ctx.storage.delete(existing.storageId);
  await ctx.db.replace("assets", existing._id, asset);
}

/**
 * Stores the file behind an asset key, replacing the one it had: an upload,
 * run from an action that uploads the file first, or a file the studio serves.
 */
export const asset = internalMutation({
  args: assetValidator.fields,
  returns: v.null(),
  handler: async (ctx, args) => {
    await saveAsset(ctx, args);
    return null;
  },
});

/**
 * Creates a suite with its items and artwork, or brings them up to date:
 * matched by slug and key, so running it twice changes nothing. Items it no
 * longer lists are retired rather than deleted, since designs started from
 * them still point at them.
 */
export const suite = internalMutation({
  args: {
    suite: v.object({
      slug: v.string(),
      name: labelsValidator,
      description: labelsValidator,
      occasion: occasionValidator,
      styles: v.array(v.string()),
      published: v.boolean(),
      sortOrder: v.number(),
      sampleFields: fieldsValidator,
    }),
    templates: v.array(
      v.object({
        slug: v.string(),
        document: documentValidator,
        shopifyProductHandle: v.optional(v.string()),
      }),
    ),
    /** The artwork the templates draw, as files the studio serves. */
    art: v.array(
      v.object({
        key: v.string(),
        path: v.string(),
        contentType: v.string(),
        recolorable: v.boolean(),
        name: v.string(),
      }),
    ),
  },
  returns: v.id("suites"),
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("suites")
      .withIndex("by_slug", (q) => q.eq("slug", args.suite.slug))
      .unique();
    const suiteId =
      existing?._id ?? (await ctx.db.insert("suites", args.suite));
    if (existing) await ctx.db.replace("suites", existing._id, args.suite);

    for (const artwork of args.art)
      await saveAsset(ctx, { ...artwork, kind: "artwork" });

    const listed = new Set<string>();
    for (const [sortOrder, template] of args.templates.entries()) {
      const parsed = documentSchema.safeParse(template.document);
      if (!parsed.success)
        throw new ConvexError(
          `${template.slug}: ${z.prettifyError(parsed.error)}`,
        );
      const document = parsed.data;
      if (document.occasion !== args.suite.occasion)
        throw new ConvexError(
          `${template.slug} is for a ${document.occasion}, the suite for a ${args.suite.occasion}`,
        );
      listed.add(template.slug);
      const fields = {
        suiteId,
        slug: template.slug,
        kind: document.kind,
        document,
        shopifyProductHandle: template.shopifyProductHandle,
        sortOrder,
      };
      const current = await ctx.db
        .query("templates")
        .withIndex("by_slug", (q) => q.eq("slug", template.slug))
        .unique();
      if (current) await ctx.db.replace("templates", current._id, fields);
      else await ctx.db.insert("templates", fields);
    }

    const offered = await ctx.db
      .query("templates")
      .withIndex("by_suiteId_and_retired_and_sortOrder", (q) =>
        q.eq("suiteId", suiteId).eq("retired", undefined),
      )
      .take(200);
    for (const template of offered)
      if (!listed.has(template.slug))
        await ctx.db.patch("templates", template._id, { retired: true });
    return suiteId;
  },
});
