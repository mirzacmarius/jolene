import { ConvexError } from "convex/values";
import type { Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import { requireUser } from "../utils/auth";
import { errors } from "../utils/errors";

/** One of the signed-in visitor's designs; anyone else's reads as not found. */
export async function requireOwnDesign(ctx: QueryCtx, designId: Id<"designs">) {
  const ownerId = await requireUser(ctx);
  const design = await ctx.db.get("designs", designId);
  if (!design || design.ownerId !== ownerId)
    throw new ConvexError(errors.notFound);
  return design;
}
