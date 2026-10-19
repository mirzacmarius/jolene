import { assetKeys, type DesignDocument } from "@jolene/design";
import { v } from "convex/values";
import type { Doc } from "./_generated/dataModel";
import { query } from "./_generated/server";
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

/** Stored documents were checked against the design schema when saved. */
const keysOf = (templates: { document: unknown }[]) =>
  templates.flatMap((template) =>
    assetKeys(template.document as DesignDocument),
  );

/**
 * The published suites in the order Jolene sets, each with its lead item (the
 * invitation, usually) to preview it by, and the files those previews draw.
 */
export const suites = query({
  args: {},
  returns: v.object({
    suites: v.array(
      v.object({
        ...suiteValidator.fields,
        lead: v.union(templateValidator, v.null()),
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
          .withIndex("by_suiteId_and_sortOrder", (q) =>
            q.eq("suiteId", suite._id),
          )
          .first();
        return { ...suiteView(suite), lead: lead ? templateView(lead) : null };
      }),
    );
    const leads = suites.flatMap((suite) => (suite.lead ? [suite.lead] : []));
    return {
      suites,
      assets: await resolveAssets(ctx, keysOf(leads), null),
    };
  },
});

/** One published suite with every item in it, or null. */
export const suite = query({
  args: { slug: v.string() },
  returns: v.union(
    v.object({
      suite: suiteValidator,
      templates: v.array(templateValidator),
      assets: v.array(resolvedAssetValidator),
    }),
    v.null(),
  ),
  handler: async (ctx, { slug }) => {
    const suite = await ctx.db
      .query("suites")
      .withIndex("by_slug", (q) => q.eq("slug", slug))
      .unique();
    if (!suite?.published) return null;
    const templates = (
      await ctx.db
        .query("templates")
        .withIndex("by_suiteId_and_sortOrder", (q) =>
          q.eq("suiteId", suite._id),
        )
        .take(24)
    ).map(templateView);
    return {
      suite: suiteView(suite),
      templates,
      assets: await resolveAssets(ctx, keysOf(templates), null),
    };
  },
});
