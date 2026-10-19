import { documentSchema } from "@jolene/design";
import { ConvexError, v } from "convex/values";
import { z } from "zod";
import { internalMutation } from "../_generated/server";
import {
  documentValidator,
  fieldsValidator,
  labelsValidator,
  occasionValidator,
} from "../utils/validators";

/**
 * Stores the file behind an asset key, replacing the one it had. Run from an
 * action, which uploads the file first.
 */
export const asset = internalMutation({
  args: {
    key: v.string(),
    storageId: v.id("_storage"),
    kind: v.union(
      v.literal("artwork"),
      v.literal("photo"),
      v.literal("texture"),
    ),
    contentType: v.string(),
    recolorable: v.boolean(),
    name: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("assets")
      .withIndex("by_key", (q) => q.eq("key", args.key))
      .unique();
    if (!existing) {
      await ctx.db.insert("assets", args);
      return null;
    }
    if (existing.storageId !== args.storageId)
      await ctx.storage.delete(existing.storageId);
    await ctx.db.replace("assets", existing._id, args);
    return null;
  },
});

/**
 * Creates a suite and its items, or brings them up to date: matched by slug,
 * so running it twice changes nothing. Items it no longer lists are kept,
 * since designs started from them still point at them.
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
    return suiteId;
  },
});
