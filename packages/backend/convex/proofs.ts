import { getAuthUserId } from "@convex-dev/auth/server";
import type { Fields } from "@jolene/design";
import { ConvexError, v } from "convex/values";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { action, mutation, type QueryCtx, query } from "./_generated/server";
import { requireOwnDesign } from "./designs";
import { errors } from "./utils/errors";
import {
  fieldsValidator,
  labelsValidator,
  productKindValidator,
} from "./utils/validators";

/** The largest picture of a proof kept, well above what the studio sends. */
const MAX_IMAGE_BYTES = 4 * 1024 * 1024;

/** Whether two sets of details say the same, in any order. */
function sameFields(a: Fields, b: Fields) {
  const keys = Object.keys(a);
  return (
    keys.length === Object.keys(b).length &&
    keys.every((key) => a[key] === b[key])
  );
}

async function latestProof(ctx: QueryCtx, designId: Id<"designs">) {
  return await ctx.db
    .query("proofs")
    .withIndex("by_designId", (q) => q.eq("designId", designId))
    .order("desc")
    .first();
}

/** The Shopify product a proof's template is ordered as, if the shop has it. */
async function productOf(ctx: QueryCtx, templateId: Id<"templates">) {
  const template = await ctx.db.get("templates", templateId);
  return template?.shopifyProductHandle ?? null;
}

/**
 * Approves a design for print as its couple sees it: the revision they looked
 * at, with the details they saw. If either changed meanwhile, nothing is
 * approved, and the studio shows them the design as it is now. Approving the
 * same again gives the proof already made.
 */
export const approve = mutation({
  args: {
    designId: v.id("designs"),
    revision: v.number(),
    fields: fieldsValidator,
  },
  returns: v.union(
    v.object({ ok: v.literal(true), proofId: v.id("proofs") }),
    v.object({ ok: v.literal(false), reason: v.literal("stale") }),
  ),
  handler: async (ctx, args) => {
    const design = await requireOwnDesign(ctx, args.designId);
    const event = await ctx.db.get("events", design.eventId);
    if (!event) throw new ConvexError(errors.notFound);
    if (
      design.revision !== args.revision ||
      !sameFields(event.fields, args.fields)
    )
      return { ok: false as const, reason: "stale" as const };
    const latest = await latestProof(ctx, design._id);
    if (
      latest?.revision === design.revision &&
      sameFields(latest.fields, event.fields)
    )
      return { ok: true as const, proofId: latest._id };
    const proofId = await ctx.db.insert("proofs", {
      designId: design._id,
      ownerId: design.ownerId,
      templateId: design.templateId,
      kind: design.kind,
      revision: design.revision,
      document: design.document,
      fields: event.fields,
      approvedAt: Date.now(),
    });
    return { ok: true as const, proofId };
  },
});

/**
 * The design's latest proof, for its owner, and whether it still shows the
 * design as it is: the same revision, with the same details.
 */
export const latest = query({
  args: { designId: v.id("designs") },
  returns: v.union(
    v.object({
      _id: v.id("proofs"),
      revision: v.number(),
      approvedAt: v.number(),
      current: v.boolean(),
      /** The Shopify product it is ordered as; null while the shop has none. */
      product: v.union(v.string(), v.null()),
    }),
    v.null(),
  ),
  handler: async (ctx, { designId }) => {
    const viewerId = await getAuthUserId(ctx);
    const design = await ctx.db.get("designs", designId);
    if (!design || design.ownerId !== viewerId) return null;
    const proof = await latestProof(ctx, designId);
    const event = await ctx.db.get("events", design.eventId);
    if (!proof || !event) return null;
    return {
      _id: proof._id,
      revision: proof.revision,
      approvedAt: proof.approvedAt,
      current:
        proof.revision === design.revision &&
        sameFields(proof.fields, event.fields),
      product: await productOf(ctx, proof.templateId),
    };
  },
});

/**
 * What the shop shows of a proof, to anyone with its link: the couple's cart
 * line and the workshop's order carry it. The document and the couple's
 * details stay in the studio; the picture shows them.
 */
export const summary = query({
  args: { proofId: v.string() },
  returns: v.union(
    v.object({
      designId: v.id("designs"),
      kind: productKindValidator,
      suite: labelsValidator,
      product: v.union(v.string(), v.null()),
      image: v.union(v.string(), v.null()),
      approvedAt: v.number(),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const proofId = ctx.db.normalizeId("proofs", args.proofId);
    const proof = proofId && (await ctx.db.get("proofs", proofId));
    if (!proof) return null;
    const template = await ctx.db.get("templates", proof.templateId);
    const suite = template && (await ctx.db.get("suites", template.suiteId));
    if (!template || !suite) return null;
    return {
      designId: proof.designId,
      kind: proof.kind,
      suite: suite.name,
      product: template.shopifyProductHandle ?? null,
      image: proof.image ? await ctx.storage.getUrl(proof.image) : null,
      approvedAt: proof.approvedAt,
    };
  },
});

/** A picture's type from its first bytes: PNG or JPEG, else null. */
function imageType(bytes: ArrayBuffer) {
  const [a, b, c, d] = new Uint8Array(bytes.slice(0, 4));
  if (a === 0x89 && b === 0x50 && c === 0x4e && d === 0x47) return "image/png";
  if (a === 0xff && b === 0xd8 && c === 0xff) return "image/jpeg";
  return null;
}

/**
 * Keeps the studio's picture of a proof for the shop and the workshop,
 * replacing the one it had. The studio sends the picture itself rather than
 * naming an upload, so a proof only ever keeps files stored here.
 */
export const attachImage = action({
  args: { proofId: v.id("proofs"), image: v.bytes() },
  returns: v.null(),
  handler: async (ctx, args): Promise<null> => {
    const type = imageType(args.image);
    if (!type || args.image.byteLength > MAX_IMAGE_BYTES)
      throw new ConvexError(errors.invalidImage);
    await ctx.runQuery(internal.proofs.image.check, { proofId: args.proofId });
    const image = await ctx.storage.store(new Blob([args.image], { type }));
    try {
      await ctx.runMutation(internal.proofs.image.set, {
        proofId: args.proofId,
        image,
      });
    } catch (error) {
      await ctx.storage.delete(image);
      throw error;
    }
    return null;
  },
});
