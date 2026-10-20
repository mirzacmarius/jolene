import { getAuthUserId } from "@convex-dev/auth/server";
import type { DesignDocument } from "@jolene/design";
import { ConvexError, type Infer, v } from "convex/values";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { type MutationCtx, mutation, query } from "./_generated/server";
import { aiConfig, MAX_MESSAGE_LENGTH, MAX_SNAPSHOT_BYTES } from "./ai/config";
import { describeView } from "./ai/context";
import {
  checkLimits,
  messagesLeft,
  messagesUsed,
  requireRoom,
} from "./ai/limits";
import {
  beginReply,
  begun,
  canRetry,
  isWorking,
  latestMessage,
  queueReply,
  shownView,
  storedImage,
} from "./ai/reply";
import { closeRendering, resumeWithRendering } from "./ai/run";
import {
  aiChangeValidator,
  aiErrorValidator,
  aiRoleValidator,
  aiStatusValidator,
} from "./ai/validators";
import { requireOwnDesign } from "./designs";
import { saveRevision } from "./designs/versions";
import { afterReply, beginOnItsOwn, waitAgain } from "./simple/compose";
import { requireUser } from "./utils/auth";
import { errors } from "./utils/errors";
import { languageValidator } from "./utils/validators";

/**
 * The AI designer, as the studio talks to it: a design's conversation, the
 * couple's messages, and undoing what a reply changed. Each reply runs in
 * ai/run.ts.
 */

type Change = Infer<typeof aiChangeValidator>;

/** Messages the studio shows; older ones stay stored but out of view. */
const SHOWN_MESSAGES = 30;

/** Replies whose changes one undo looks through. */
const UNDO_REPLIES = 60;

/** One of the signed-in visitor's messages; anyone else's reads as not found. */
async function requireOwnMessage(
  ctx: MutationCtx,
  messageId: Id<"aiMessages">,
) {
  const ownerId = await requireUser(ctx);
  const message = await ctx.db.get("aiMessages", messageId);
  if (!message || message.ownerId !== ownerId)
    throw new ConvexError(errors.notFound);
  return message;
}

/**
 * A rendering the studio uploaded, if it can go to the model: a PNG or JPEG
 * (its bytes are checked when sent) small enough for the API.
 */
async function imageFile(ctx: MutationCtx, storageId: Id<"_storage">) {
  const file = await ctx.db.system.get("_storage", storageId);
  if (
    !file ||
    file.size > MAX_SNAPSHOT_BYTES ||
    (file.contentType !== undefined &&
      file.contentType !== "image/png" &&
      file.contentType !== "image/jpeg")
  )
    return undefined;
  return storageId;
}

const shownMessage = v.object({
  _id: v.id("aiMessages"),
  _creationTime: v.number(),
  role: aiRoleValidator,
  /** The couple's words, or the reply as far as it is written. */
  text: v.string(),
  status: aiStatusValidator,
  /** What the AI designer noted while it worked. */
  notes: v.array(v.string()),
  changes: v.array(aiChangeValidator),
  error: v.optional(aiErrorValidator),
  /** The latest reply, failed for a passing reason: it can run again. */
  canRetry: v.boolean(),
  /** The rendering the reply waits for, and the revision to draw. */
  rendering: v.optional(
    v.object({ toolUseId: v.string(), revision: v.number() }),
  ),
});

/** The design's conversation with the AI designer, oldest first. */
export const messages = query({
  args: { designId: v.id("designs") },
  returns: v.array(shownMessage),
  handler: async (ctx, { designId }) => {
    const viewerId = await getAuthUserId(ctx);
    const design = await ctx.db.get("designs", designId);
    if (!design || design.ownerId !== viewerId) return [];
    const latest = await ctx.db
      .query("aiMessages")
      .withIndex("by_designId", (q) => q.eq("designId", designId))
      .order("desc")
      .take(SHOWN_MESSAGES);
    return latest.reverse().map((message, index, shown) => ({
      _id: message._id,
      _creationTime: message._creationTime,
      role: message.role,
      text: message.text,
      status: message.status,
      notes: message.notes ?? [],
      changes: message.changes ?? [],
      ...(message.error ? { error: message.error } : {}),
      canRetry: index === shown.length - 1 && canRetry(message),
      ...(message.rendering ? { rendering: message.rendering } : {}),
    }));
  },
});

/**
 * Whether the AI designer works on this deployment, and how many of the
 * day's messages the visitor has sent. `since` is the start of the day in
 * UTC, from the studio's clock: a query can't read the time itself.
 */
export const availability = query({
  args: { since: v.number() },
  returns: v.object({
    configured: v.boolean(),
    limit: v.number(),
    used: v.number(),
  }),
  handler: async (ctx, { since }) => {
    const config = aiConfig();
    const userId = await getAuthUserId(ctx);
    if (!config.configured || !userId)
      return {
        configured: config.configured,
        limit: config.dailyLimit,
        used: 0,
      };
    return {
      configured: true,
      limit: config.dailyLimit,
      used: await messagesUsed(ctx, userId, since, config.dailyLimit),
    };
  },
});

/** Where the studio uploads a rendering of the design to send with a message. */
export const generateUploadUrl = mutation({
  args: {},
  returns: v.string(),
  handler: async (ctx) => {
    await requireUser(ctx);
    if (!aiConfig().configured) throw new ConvexError(errors.aiUnavailable);
    return await ctx.storage.generateUploadUrl();
  },
});

/**
 * Sends the couple's words to the AI designer, with the design as they see
 * it, and starts the reply. One reply runs at a time for each design.
 */
export const send = mutation({
  args: {
    designId: v.id("designs"),
    text: v.string(),
    /** The studio's language, which the reply is written in. */
    locale: languageValidator,
    /** What the studio shows: "assembly", or one face as "piece:face". */
    view: v.optional(v.string()),
    /** The studio's rendering of that view (generateUploadUrl). */
    snapshot: v.optional(v.id("_storage")),
  },
  returns: v.id("aiMessages"),
  handler: async (ctx, args) => {
    const design = await requireOwnDesign(ctx, args.designId);
    const config = aiConfig();
    if (!config.configured) throw new ConvexError(errors.aiUnavailable);
    const text = args.text.trim();
    if (!text || text.length > MAX_MESSAGE_LENGTH)
      throw new ConvexError(errors.aiInvalidMessage);
    const latest = await latestMessage(ctx, design._id);
    if (latest && isWorking(latest)) throw new ConvexError(errors.aiBusy);
    await checkLimits(ctx, design.ownerId, config, Date.now());
    const snapshot = args.snapshot && (await imageFile(ctx, args.snapshot));
    const reply = await queueReply(ctx, {
      design,
      text,
      locale: args.locale,
      ...(snapshot ? { snapshot } : {}),
      status: "pending",
    });
    await beginReply(ctx, reply, { view: args.view });
    return reply._id;
  },
});

/**
 * Stops a reply. What it changed so far stays, each change undoable; what it
 * was writing stops where it is. A reply stopped before its first request
 * is refunded.
 */
export const stop = mutation({
  args: { messageId: v.id("aiMessages") },
  returns: v.null(),
  handler: async (ctx, { messageId }) => {
    const message = await requireOwnMessage(ctx, messageId);
    if (!isWorking(message)) return null;
    await closeRendering(ctx, message);
    const now = Date.now();
    const unasked =
      (message.status === "waiting" || message.status === "pending") &&
      !message.usage;
    await ctx.db.patch("aiMessages", messageId, {
      status: "stopped",
      rendering: undefined,
      pendingResults: undefined,
      ...(unasked ? { refunded: true as const } : {}),
      finishedAt: now,
      updatedAt: now,
    });
    await afterReply(ctx, message);
    return null;
  },
});

/**
 * Runs the latest reply's failed request again. A refunded reply counts
 * again, within the day's limits. A collection's first item takes the items
 * that failed with it along (simple/compose.ts), and one of those items
 * begins on its own.
 */
export const retry = mutation({
  args: { messageId: v.id("aiMessages") },
  returns: v.null(),
  handler: async (ctx, { messageId }) => {
    const message = await requireOwnMessage(ctx, messageId);
    const latest = await latestMessage(ctx, message.designId);
    if (latest?._id !== messageId || !canRetry(message))
      throw new ConvexError(errors.notFound);
    const config = aiConfig();
    if (!config.configured) throw new ConvexError(errors.aiUnavailable);
    const now = Date.now();
    const left = await messagesLeft(ctx, message.ownerId, config, now);
    if (message.refunded) requireRoom(left);
    await ctx.db.patch("aiMessages", messageId, {
      error: undefined,
      refunded: undefined,
      finishedAt: undefined,
      updatedAt: now,
    });
    if (!begun(message)) {
      const reply = await ctx.db.get("aiMessages", messageId);
      if (reply) await beginOnItsOwn(ctx, reply);
      return null;
    }
    await ctx.db.patch("aiMessages", messageId, { status: "pending" });
    await ctx.scheduler.runAfter(0, internal.ai.run.step, { messageId });
    await waitAgain(
      ctx,
      message,
      Math.min(left.visitor, left.everyone) - (message.refunded ? 1 : 0),
    );
    return null;
  },
});

/**
 * Undoes one change of a reply. A change to the design brings back the
 * version just before it, as a restore from the versions list would, so
 * every later change goes with it; a change to the details puts back the
 * values it replaced.
 */
export const undo = mutation({
  args: {
    messageId: v.id("aiMessages"),
    /** The change's place in the reply's list of changes. */
    change: v.number(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const message = await requireOwnMessage(ctx, args.messageId);
    const change = message.changes?.[args.change];
    if (!change) throw new ConvexError(errors.notFound);
    if (change.undoneAt !== undefined) return null;
    const design = await ctx.db.get("designs", message.designId);
    if (!design) throw new ConvexError(errors.notFound);
    const now = Date.now();

    if (change.kind === "details") {
      const event = await ctx.db.get("events", design.eventId);
      if (!event) throw new ConvexError(errors.notFound);
      const fields = { ...event.fields };
      for (const [key, value] of Object.entries(change.previous)) {
        if (value === "") delete fields[key];
        else fields[key] = value;
      }
      await ctx.db.patch("events", event._id, { fields, updatedAt: now });
      await ctx.db.patch("aiMessages", message._id, {
        changes: message.changes?.map((each, index) =>
          index === args.change ? { ...each, undoneAt: now } : each,
        ),
      });
      return null;
    }

    const before = await ctx.db
      .query("designVersions")
      .withIndex("by_designId_and_revision", (q) =>
        q.eq("designId", design._id).lt("revision", change.revision),
      )
      .order("desc")
      .first();
    if (!before) throw new ConvexError(errors.notFound);
    await saveRevision(ctx, design, before.document as DesignDocument, {
      author: "person",
      restoredFrom: before.revision,
    });
    // The restore takes back every later change of the design too.
    const replies = await ctx.db
      .query("aiMessages")
      .withIndex("by_designId", (q) => q.eq("designId", design._id))
      .order("desc")
      .take(UNDO_REPLIES);
    const goneWith = (each: Change[]) =>
      each.map((later) =>
        later.kind === "design" &&
        later.revision > before.revision &&
        later.undoneAt === undefined
          ? { ...later, undoneAt: now }
          : later,
      );
    for (const reply of replies) {
      const changes = reply.changes ?? [];
      const updated = goneWith(changes);
      if (updated.some((each, index) => each !== changes[index]))
        await ctx.db.patch("aiMessages", reply._id, { changes: updated });
    }
    return null;
  },
});

const textFitValidator = v.object({
  piece: v.string(),
  face: v.union(v.literal("front"), v.literal("back")),
  layer: v.string(),
  size: v.number(),
  styleSize: v.number(),
  overflows: v.boolean(),
  outsideSafeArea: v.boolean(),
});

/** Text layers a rendering's report lists at most. */
const MAX_REPORTED_LAYERS = 60;

/**
 * The studio's answer to a reply that asked to see the design
 * (look_at_design): a rendering of the view it shows and how each text sits,
 * measured in the real fonts. False when the reply no longer waits for it.
 */
export const answerRendering = mutation({
  args: {
    messageId: v.id("aiMessages"),
    toolUseId: v.string(),
    /** The design's revision the studio drew. */
    revision: v.number(),
    view: v.string(),
    snapshot: v.optional(v.id("_storage")),
    /** Text layers that overflow, shrink or reach past the safe margin. */
    layers: v.optional(v.array(textFitValidator)),
  },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const message = await requireOwnMessage(ctx, args.messageId);
    if (
      message.status !== "rendering" ||
      message.rendering?.toolUseId !== args.toolUseId
    )
      return false;
    const design = await ctx.db.get("designs", message.designId);
    if (!design) return false;
    const snapshot = args.snapshot && (await imageFile(ctx, args.snapshot));
    if (!snapshot && !args.layers) {
      await resumeWithRendering(ctx, message, {
        type: "tool_result",
        tool_use_id: args.toolUseId,
        is_error: true,
        content:
          "The studio could not draw the design this time. Carry on without seeing it.",
      });
      return true;
    }
    const view = shownView(args.view, design.document as DesignDocument);
    const report = {
      revision: args.revision,
      showing: describeView(view),
      ...(args.layers
        ? {
            measuredWith: "fonts",
            textFit: args.layers.slice(0, MAX_REPORTED_LAYERS),
          }
        : {}),
    };
    await resumeWithRendering(ctx, message, {
      type: "tool_result",
      tool_use_id: args.toolUseId,
      content: [
        { type: "text", text: JSON.stringify(report) },
        ...(snapshot ? [storedImage(snapshot)] : []),
      ],
    });
    return true;
  },
});
