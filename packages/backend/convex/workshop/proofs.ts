import { assetKeys, type DesignDocument, namesOf } from "@jolene/design";
import type { Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import { resolveAssets } from "../utils/assets";

/**
 * What a proof's print file is made from: the design the couple approved,
 * with their details and the files it draws. Their photos resolve as they
 * did for the couple, who alone may use them.
 */
export async function printJobOf(ctx: QueryCtx, proofId: Id<"proofs">) {
  const proof = await ctx.db.get("proofs", proofId);
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
