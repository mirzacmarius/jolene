import { ConvexError, v } from "convex/values";
import type { Id } from "../_generated/dataModel";
import {
  internalMutation,
  internalQuery,
  type QueryCtx,
} from "../_generated/server";
import { requireUser } from "../utils/auth";
import { errors } from "../utils/errors";

/** One of the signed-in visitor's proofs; anyone else's reads as not found. */
async function requireOwnProof(ctx: QueryCtx, proofId: Id<"proofs">) {
  const ownerId = await requireUser(ctx);
  const proof = await ctx.db.get("proofs", proofId);
  if (!proof || proof.ownerId !== ownerId)
    throw new ConvexError(errors.notFound);
  return proof;
}

/** Throws unless the visitor owns the proof, before its picture is stored. */
export const check = internalQuery({
  args: { proofId: v.id("proofs") },
  returns: v.null(),
  handler: async (ctx, { proofId }) => {
    await requireOwnProof(ctx, proofId);
    return null;
  },
});

/**
 * Gives a proof the picture just stored for it, deleting the one it replaces:
 * every picture a proof keeps was stored by attachImage, never named by the
 * studio, so no one else's file can be deleted here.
 */
export const set = internalMutation({
  args: { proofId: v.id("proofs"), image: v.id("_storage") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const proof = await requireOwnProof(ctx, args.proofId);
    if (proof.image) await ctx.storage.delete(proof.image);
    await ctx.db.patch("proofs", proof._id, { image: args.image });
    return null;
  },
});
