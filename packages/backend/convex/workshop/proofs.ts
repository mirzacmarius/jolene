import { assetKeys, type DesignDocument, namesOf } from "@jolene/design";
import { v } from "convex/values";
import { internalQuery, type QueryCtx } from "../_generated/server";
import { resolveAssets } from "../utils/assets";
import { requireWorkshop } from "./staff";
import { proofValidator } from "./validators";

/** The most proofs one call reads: each holds a whole design. */
export const PROOFS_PER_CALL = 25;

/**
 * The proofs that orders' lines name, for the workshop. A line's attribute
 * is any text a cart sent, so IDs the studio doesn't have are left out.
 */
export const summaries = internalQuery({
  args: { ids: v.array(v.string()) },
  returns: v.array(proofValidator),
  handler: async (ctx, { ids }) => {
    await requireWorkshop(ctx);
    const found = [];
    for (const raw of ids.slice(0, PROOFS_PER_CALL)) {
      const id = ctx.db.normalizeId("proofs", raw);
      const proof = id && (await ctx.db.get("proofs", id));
      if (!proof) continue;
      const template = await ctx.db.get("templates", proof.templateId);
      const suite = template && (await ctx.db.get("suites", template.suiteId));
      found.push({
        id: proof._id,
        kind: proof.kind,
        suite: suite?.name ?? null,
        image: proof.image ? await ctx.storage.getUrl(proof.image) : null,
        approvedAt: proof.approvedAt,
      });
    }
    return found;
  },
});

/**
 * What a proof's print file is made from: the design the couple approved,
 * with their details and the files it draws. Their photos resolve as they did
 * for the couple, who alone may use them.
 */
export async function printJobOf(ctx: QueryCtx, raw: string) {
  await requireWorkshop(ctx);
  const id = ctx.db.normalizeId("proofs", raw);
  const proof = id && (await ctx.db.get("proofs", id));
  if (!proof) return null;
  const template = await ctx.db.get("templates", proof.templateId);
  const suite = template && (await ctx.db.get("suites", template.suiteId));
  // Stored documents were checked against the design schema when saved.
  const document = proof.document as DesignDocument;
  return {
    kind: proof.kind,
    suite: suite?.name ?? null,
    names: namesOf(proof.fields, document.occasion),
    document: proof.document,
    fields: proof.fields,
    assets: await resolveAssets(ctx, assetKeys(document), proof.ownerId),
  };
}
