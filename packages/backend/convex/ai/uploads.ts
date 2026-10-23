import { ConvexError, v } from "convex/values";
import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { internalMutation, type MutationCtx } from "../_generated/server";
import { requireUser } from "../utils/auth";
import { errors } from "../utils/errors";
import { rateLimiter } from "../utils/limits";
import { aiConfig } from "./config";

/**
 * Drawings of a design the studio stores for the AI designer to see
 * (ai.uploadImage). Each waits in aiUploads until the message or rendering
 * it was drawn for takes it; one nothing took is deleted after an hour, so
 * no file stored here outlives what it was for.
 */

/** How long a drawing waits to be taken. */
const UPLOAD_KEPT = 60 * 60 * 1000;

/** Drawings deleted at a time; more go in a scheduled run. */
const UPLOADS_FORGOTTEN = 100;

/**
 * The visitor who may store a drawing now, or an error: the AI designer
 * isn't set up, or they or everyone together have stored many lately.
 */
export const allow = internalMutation({
  args: {},
  returns: v.id("users"),
  handler: async (ctx) => {
    const ownerId = await requireUser(ctx);
    if (!aiConfig().configured) throw new ConvexError(errors.aiUnavailable);
    const mine = await rateLimiter.limit(ctx, "aiUpload", { key: ownerId });
    const everyone = await rateLimiter.limit(ctx, "aiUploads");
    if (!mine.ok || !everyone.ok) throw new ConvexError(errors.tooMany);
    return ownerId;
  },
});

/** Keeps a drawing just stored for its visitor until it's taken. */
export const keep = internalMutation({
  args: { ownerId: v.id("users"), storageId: v.id("_storage") },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.insert("aiUploads", args);
    return null;
  },
});

/**
 * Takes a drawing for one of the visitor's messages or renderings: one they
 * stored that nothing has taken yet, which then stays with what took it.
 * Undefined for any other file.
 */
export async function takeUpload(
  ctx: MutationCtx,
  ownerId: Id<"users">,
  storageId: Id<"_storage">,
) {
  const upload = await ctx.db
    .query("aiUploads")
    .withIndex("by_storageId", (q) => q.eq("storageId", storageId))
    .unique();
  if (!upload || upload.ownerId !== ownerId) return undefined;
  await ctx.db.delete("aiUploads", upload._id);
  return storageId;
}

/** Deletes the drawings stored an hour ago or more that nothing took. */
export const forget = internalMutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const old = await ctx.db
      .query("aiUploads")
      .withIndex("by_creation_time", (q) =>
        q.lt("_creationTime", Date.now() - UPLOAD_KEPT),
      )
      .take(UPLOADS_FORGOTTEN);
    for (const upload of old) {
      if (await ctx.db.system.get("_storage", upload.storageId))
        await ctx.storage.delete(upload.storageId);
      await ctx.db.delete("aiUploads", upload._id);
    }
    if (old.length === UPLOADS_FORGOTTEN)
      await ctx.scheduler.runAfter(0, internal.ai.uploads.forget, {});
    return null;
  },
});
