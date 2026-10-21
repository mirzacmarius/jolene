import { v } from "convex/values";
import type { Doc } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";

/**
 * A photo as the shop shows it: from Convex storage when it was put there,
 * otherwise from its address, which the seed gives as the photo store's
 * (ADR 0016).
 */
export const photoValidator = v.object({ url: v.string(), alt: v.string() });

export const photoView = async (
  ctx: QueryCtx,
  { source, alt, storageId }: Doc<"products">["images"][number],
) => ({
  url: (storageId && (await ctx.storage.getUrl(storageId))) || source,
  alt,
});
