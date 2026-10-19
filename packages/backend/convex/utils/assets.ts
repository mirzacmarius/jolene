import { v } from "convex/values";
import type { Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";

export const resolvedAssetValidator = v.object({
  key: v.string(),
  url: v.string(),
  contentType: v.string(),
  recolorable: v.boolean(),
});

/**
 * Links to the files documents draw, found by asset key. A photo resolves only
 * for its owner; a key with no file is left out, and the renderer draws a
 * placeholder where it would go.
 */
export async function resolveAssets(
  ctx: QueryCtx,
  keys: Iterable<string>,
  viewerId: Id<"users"> | null,
) {
  const resolved = [];
  for (const key of new Set(keys)) {
    const asset = await ctx.db
      .query("assets")
      .withIndex("by_key", (q) => q.eq("key", key))
      .unique();
    if (!asset || (asset.ownerId && asset.ownerId !== viewerId)) continue;
    const url = await ctx.storage.getUrl(asset.storageId);
    if (!url) continue;
    resolved.push({
      key,
      url,
      contentType: asset.contentType,
      recolorable: asset.recolorable,
    });
  }
  return resolved;
}
