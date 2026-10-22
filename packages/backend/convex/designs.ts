import { getAuthUserId } from "@convex-dev/auth/server";
import { assetKeys, type DesignDocument } from "@jolene/design";
import { ConvexError, v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { type MutationCtx, mutation, query } from "./_generated/server";
import { applyToDesign } from "./designs/apply";
import { MOST_PICKS, PICK_LENGTH, withPick } from "./designs/finishes";
import { saveRevision } from "./designs/versions";
import { latestEvent } from "./events";
import schema from "./schema";
import { MAX_QUANTITY } from "./shop/pricing";
import { answerValidator, pickedValidator } from "./shop/validators";
import { resolveAssets, resolvedAssetValidator } from "./utils/assets";
import { requireUser } from "./utils/auth";
import { errors } from "./utils/errors";
import { authorValidator, labelsValidator } from "./utils/validators";

/** Stored documents were checked against the design schema when saved. */
const documentOf = (stored: { document: unknown }) =>
  stored.document as DesignDocument;

/** One of the signed-in visitor's designs; anyone else's reads as not found. */
export async function requireOwnDesign(
  ctx: MutationCtx,
  designId: Id<"designs">,
) {
  const ownerId = await requireUser(ctx);
  const design = await ctx.db.get("designs", designId);
  if (!design || design.ownerId !== ownerId)
    throw new ConvexError(errors.notFound);
  return design;
}

/**
 * A new design of the event, a copy of the template, whose first version is
 * the template itself.
 */
export async function createDesign(
  ctx: MutationCtx,
  {
    ownerId,
    eventId,
    template,
  }: {
    ownerId: Id<"users">;
    eventId: Id<"events">;
    template: Doc<"templates">;
  },
) {
  const document = documentOf(template);
  const now = Date.now();
  const designId = await ctx.db.insert("designs", {
    ownerId,
    eventId,
    templateId: template._id,
    kind: template.kind,
    document,
    revision: 1,
    updatedAt: now,
  });
  await ctx.db.insert("designVersions", {
    designId,
    revision: 1,
    document,
    author: "template",
    updatedAt: now,
  });
  return designId;
}

/**
 * Starts a design from a template. The couple's details carry over from their
 * latest event of the same occasion, whichever collection its designs come
 * from, so a save-the-date started after the invitation already has their
 * names; their first design starts the event.
 */
export const start = mutation({
  args: { template: v.string() },
  returns: v.id("designs"),
  handler: async (ctx, args) => {
    const ownerId = await requireUser(ctx);
    const template = await ctx.db
      .query("templates")
      .withIndex("by_slug", (q) => q.eq("slug", args.template))
      .unique();
    if (!template || template.retired) throw new ConvexError(errors.notFound);
    const { occasion } = documentOf(template);
    const event = await latestEvent(ctx, ownerId, occasion);
    const eventId =
      event?._id ??
      (await ctx.db.insert("events", {
        ownerId,
        occasion,
        fields: {},
        updatedAt: Date.now(),
      }));
    return await createDesign(ctx, { ownerId, eventId, template });
  },
});

/**
 * A design with its event and the files it draws, for its owner; null for a
 * link that isn't a design of theirs.
 */
export const get = query({
  args: { designId: v.string() },
  returns: v.union(
    v.object({
      design: schema.doc("designs"),
      event: schema.doc("events"),
      template: v.object({
        slug: v.string(),
        suite: v.object({ slug: v.string(), name: labelsValidator }),
      }),
      /** Simple mode has made the design's collection for its event. */
      composed: v.boolean(),
      assets: v.array(resolvedAssetValidator),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const viewerId = await getAuthUserId(ctx);
    const designId = ctx.db.normalizeId("designs", args.designId);
    const design = designId && (await ctx.db.get("designs", designId));
    if (!design || design.ownerId !== viewerId) return null;
    const event = await ctx.db.get("events", design.eventId);
    const template = await ctx.db.get("templates", design.templateId);
    const suite = template && (await ctx.db.get("suites", template.suiteId));
    if (!event || !template || !suite) return null;
    const composition = await ctx.db
      .query("compositions")
      .withIndex("by_eventId_and_suiteId", (q) =>
        q.eq("eventId", event._id).eq("suiteId", suite._id),
      )
      .first();
    return {
      design,
      event,
      template: {
        slug: template.slug,
        suite: { slug: suite.slug, name: suite.name },
      },
      composed: composition !== null,
      assets: await resolveAssets(ctx, assetKeys(documentOf(design)), viewerId),
    };
  },
});

/**
 * The signed-in visitor's latest designs, with what their previews need and
 * the collection each one started from.
 */
export const mine = query({
  args: {},
  returns: v.object({
    designs: v.array(schema.doc("designs")),
    events: v.array(schema.doc("events")),
    templates: v.array(
      v.object({
        _id: v.id("templates"),
        suite: v.object({ slug: v.string(), name: labelsValidator }),
      }),
    ),
    assets: v.array(resolvedAssetValidator),
  }),
  handler: async (ctx) => {
    const ownerId = await getAuthUserId(ctx);
    if (!ownerId) return { designs: [], events: [], templates: [], assets: [] };
    const designs = await ctx.db
      .query("designs")
      .withIndex("by_ownerId_and_updatedAt", (q) => q.eq("ownerId", ownerId))
      .order("desc")
      .take(24);
    const eventIds = [...new Set(designs.map((design) => design.eventId))];
    const events = (
      await Promise.all(eventIds.map((id) => ctx.db.get("events", id)))
    ).filter((event) => event !== null);
    const templateIds = [
      ...new Set(designs.map((design) => design.templateId)),
    ];
    const templates = await Promise.all(
      templateIds.map(async (templateId) => {
        const template = await ctx.db.get("templates", templateId);
        const suite =
          template && (await ctx.db.get("suites", template.suiteId));
        return suite
          ? { _id: templateId, suite: { slug: suite.slug, name: suite.name } }
          : null;
      }),
    );
    const keys = designs.flatMap((design) => assetKeys(documentOf(design)));
    return {
      designs,
      events,
      templates: templates.filter((template) => template !== null),
      assets: await resolveAssets(ctx, keys, ownerId),
    };
  },
});

const applyResult = v.union(
  v.object({ ok: v.literal(true), revision: v.number() }),
  v.object({
    ok: v.literal(false),
    /** "stale": the design changed since `expectedRevision`. */
    reason: v.union(v.literal("stale"), v.literal("invalid")),
    message: v.string(),
    revision: v.number(),
  }),
);

/**
 * Changes a design by operations (@jolene/design's ops.ts), all or nothing.
 * Operations patch what they name, so the editor sends them without
 * `expectedRevision`; the AI, which designs against one revision, sends it so
 * a change the person made meanwhile isn't overwritten.
 */
export const apply = mutation({
  args: {
    designId: v.id("designs"),
    operations: v.array(v.any()),
    expectedRevision: v.optional(v.number()),
    note: v.optional(v.string()),
  },
  returns: applyResult,
  handler: async (ctx, args) => {
    const design = await requireOwnDesign(ctx, args.designId);
    const applied = await applyToDesign(ctx, design, args.operations, {
      author: "person",
      note: args.note,
      expectedRevision: args.expectedRevision,
    });
    if (!applied.ok) return applied;
    return { ok: true as const, revision: applied.revision };
  },
});

/** A pick's name or value as a design keeps it: some text, not too long. */
const isPick = (text: string) => text.length > 0 && text.length <= PICK_LENGTH;

/**
 * Keeps one of the couple's picks to order the design (ADR 0021): how many,
 * a value of one of the product's options, such as its paper, or an order
 * option's answer, empty for none of its choices. What a pick shows on the
 * design reaches it through `apply`, as an edit, so it can be undone.
 */
export const setFinishes = mutation({
  args: {
    designId: v.id("designs"),
    quantity: v.optional(v.number()),
    option: v.optional(pickedValidator),
    answer: v.optional(answerValidator),
  },
  returns: v.null(),
  handler: async (ctx, { designId, ...pick }) => {
    const { quantity, option, answer } = pick;
    const design = await requireOwnDesign(ctx, designId);
    if (
      (quantity !== undefined &&
        !(
          Number.isInteger(quantity) &&
          quantity >= 1 &&
          quantity <= MAX_QUANTITY
        )) ||
      (option !== undefined &&
        !(isPick(option.name) && isPick(option.value))) ||
      (answer !== undefined &&
        !(isPick(answer.key) && answer.value.length <= PICK_LENGTH))
    )
      throw new ConvexError(errors.invalidInput);

    const finishes = withPick(design.finishes, pick);
    if (
      finishes.options.length > MOST_PICKS ||
      finishes.answers.length > MOST_PICKS
    )
      throw new ConvexError(errors.invalidInput);
    await ctx.db.patch("designs", design._id, {
      finishes,
      updatedAt: Date.now(),
    });
    return null;
  },
});

/** The design's saved versions, newest first, without their documents. */
export const versions = query({
  args: { designId: v.id("designs") },
  returns: v.array(
    v.object({
      _id: v.id("designVersions"),
      _creationTime: v.number(),
      revision: v.number(),
      author: authorValidator,
      note: v.optional(v.string()),
      restoredFrom: v.optional(v.number()),
      updatedAt: v.number(),
    }),
  ),
  handler: async (ctx, { designId }) => {
    const viewerId = await getAuthUserId(ctx);
    const design = await ctx.db.get("designs", designId);
    if (!design || design.ownerId !== viewerId) return [];
    const versions = await ctx.db
      .query("designVersions")
      .withIndex("by_designId_and_revision", (q) => q.eq("designId", designId))
      .order("desc")
      .take(50);
    return versions.map(
      ({ document: _document, designId: _designId, ...version }) => version,
    );
  },
});

/**
 * Brings back an earlier version as the design's newest. What it replaces
 * stays in the list, so a restore can itself be undone.
 */
export const restore = mutation({
  args: { versionId: v.id("designVersions") },
  returns: v.number(),
  handler: async (ctx, { versionId }) => {
    const version = await ctx.db.get("designVersions", versionId);
    if (!version) throw new ConvexError(errors.notFound);
    const design = await requireOwnDesign(ctx, version.designId);
    return await saveRevision(ctx, design, documentOf(version), {
      author: "person",
      restoredFrom: version.revision,
    });
  },
});
