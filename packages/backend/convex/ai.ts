import { getAuthUserId } from "@convex-dev/auth/server";
import { type DesignDocument, faceNames, fieldKeysUsed } from "@jolene/design";
import { ConvexError, type Infer, v } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { type MutationCtx, mutation, query } from "./_generated/server";
import {
  type AiConfig,
  aiConfig,
  MAX_MESSAGE_LENGTH,
  MAX_SNAPSHOT_BYTES,
  startOfDay,
  THREAD_TOKEN_LIMIT,
} from "./ai/config";
import { describeView, detailsKey, messageContext, recap } from "./ai/context";
import { promptVersion } from "./ai/request";
import { closeRendering, resumeWithRendering, storedImage } from "./ai/run";
import {
  aiChangeValidator,
  aiErrorValidator,
  aiRoleValidator,
  aiStatusValidator,
} from "./ai/validators";
import { requireOwnDesign } from "./designs";
import { saveRevision } from "./designs/versions";
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

/** Earlier messages a thread that starts afresh is told about. */
const RECAP_MESSAGES = 24;

/** Replies whose changes one undo looks through. */
const UNDO_REPLIES = 60;

const isWorking = (message: Doc<"aiMessages">) =>
  message.status === "pending" ||
  message.status === "streaming" ||
  message.status === "rendering";

/** A reply that failed for a passing reason can run its request again. */
const canRetry = (message: Doc<"aiMessages">) =>
  message.role === "designer" &&
  message.status === "failed" &&
  message.error !== "refused" &&
  !message.endsThread;

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

async function latestMessage(ctx: MutationCtx, designId: Id<"designs">) {
  return await ctx.db
    .query("aiMessages")
    .withIndex("by_designId", (q) => q.eq("designId", designId))
    .order("desc")
    .first();
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

/** The view the studio named, if the design has it: "assembly" or "piece:face". */
function shownView(view: string | undefined, document: DesignDocument) {
  if (!view || view === "assembly") return "assembly";
  const [piece, face] = view.split(":");
  const known = document.pieces.find((candidate) => candidate.id === piece);
  return known && faceNames.some((name) => name === face && known[name])
    ? view
    : "assembly";
}

/** Today's messages, the visitor's own and everyone's, within the limits. */
async function checkLimits(
  ctx: MutationCtx,
  ownerId: Id<"users">,
  config: AiConfig,
  now: number,
) {
  const since = startOfDay(now);
  const sent = await ctx.db
    .query("aiMessages")
    .withIndex("by_ownerId_and_role", (q) =>
      q.eq("ownerId", ownerId).eq("role", "couple").gte("_creationTime", since),
    )
    .take(config.dailyLimit);
  if (sent.length >= config.dailyLimit) throw new ConvexError(errors.aiLimit);
  const everyone = await ctx.db
    .query("aiMessages")
    .withIndex("by_role", (q) =>
      q.eq("role", "couple").gte("_creationTime", since),
    )
    .take(config.totalDailyLimit);
  if (everyone.length >= config.totalDailyLimit)
    throw new ConvexError(errors.aiLimitTotal);
}

/**
 * Earlier exchanges for a thread that starts afresh, oldest first. A request
 * the model declined is left out, so it isn't asked again.
 */
function recapOf(messages: Doc<"aiMessages">[]) {
  return recap(
    messages.filter((message, index) => {
      const reply = message.role === "couple" ? messages[index + 1] : message;
      return reply?.error !== "refused";
    }),
  );
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
    const sent = await ctx.db
      .query("aiMessages")
      .withIndex("by_ownerId_and_role", (q) =>
        q
          .eq("ownerId", userId)
          .eq("role", "couple")
          .gte("_creationTime", since),
      )
      .take(config.dailyLimit);
    return { configured: true, limit: config.dailyLimit, used: sent.length };
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
    const recent = (
      await ctx.db
        .query("aiMessages")
        .withIndex("by_designId", (q) => q.eq("designId", design._id))
        .order("desc")
        .take(RECAP_MESSAGES)
    ).reverse();
    const latest = recent.at(-1);
    if (latest && isWorking(latest)) throw new ConvexError(errors.aiBusy);
    const now = Date.now();
    await checkLimits(ctx, design.ownerId, config, now);

    const event = await ctx.db.get("events", design.eventId);
    const template = await ctx.db.get("templates", design.templateId);
    const suite = template && (await ctx.db.get("suites", template.suiteId));
    if (!event || !suite) throw new ConvexError(errors.notFound);
    const document = design.document as DesignDocument;
    const snapshot = args.snapshot && (await imageFile(ctx, args.snapshot));
    const prompt = promptVersion(config);
    const details = detailsKey(event.fields);

    // A thread goes on while the API can read it whole and as it was.
    const goesOn =
      latest?.role === "designer" &&
      !latest.endsThread &&
      latest.prompt === prompt &&
      (latest.contextTokens ?? 0) <= THREAD_TOKEN_LIMIT;
    const thread = goesOn ? latest.thread : (latest?.thread ?? 0) + 1;
    const lastSent = recent.findLast((message) => message.role === "couple");
    const undone = recent.flatMap((message) =>
      (message.changes ?? []).flatMap((change) =>
        change.undoneAt !== undefined &&
        change.undoneAt > (lastSent?._creationTime ?? 0)
          ? [change.note]
          : [],
      ),
    );
    const context = messageContext({
      locale: args.locale,
      view: shownView(args.view, document),
      revision: design.revision,
      document,
      designChanged: !goesOn || latest.seen?.revision !== design.revision,
      occasion: event.occasion,
      details: event.fields,
      detailsChanged: !goesOn || latest.seen?.details !== details,
      used: fieldKeysUsed(document),
      collection: {
        name:
          suite.name.en === suite.name.ro
            ? suite.name.en
            : `${suite.name.en} (in Romanian: ${suite.name.ro})`,
        styles: suite.styles,
      },
      undone,
      recap: goesOn || recent.length === 0 ? undefined : recapOf(recent),
      snapshot: Boolean(snapshot),
    });

    const sentId = await ctx.db.insert("aiMessages", {
      designId: design._id,
      ownerId: design.ownerId,
      role: "couple",
      text,
      status: "done",
      thread,
      locale: args.locale,
      ...(snapshot ? { snapshot } : {}),
      finishedAt: now,
      updatedAt: now,
    });
    await ctx.db.insert("aiTurns", {
      designId: design._id,
      thread,
      messageId: sentId,
      role: "user",
      content: JSON.stringify([
        { type: "text", text: context },
        ...(snapshot ? [storedImage(snapshot)] : []),
        { type: "text", text },
      ]),
    });
    const replyId = await ctx.db.insert("aiMessages", {
      designId: design._id,
      ownerId: design.ownerId,
      role: "designer",
      text: "",
      status: "pending",
      thread,
      locale: args.locale,
      prompt,
      seen: { revision: design.revision, details },
      updatedAt: now,
    });
    await ctx.scheduler.runAfter(0, internal.ai.run.step, {
      messageId: replyId,
    });
    return replyId;
  },
});

/**
 * Stops a reply. What it changed so far stays, each change undoable; what it
 * was writing stops where it is.
 */
export const stop = mutation({
  args: { messageId: v.id("aiMessages") },
  returns: v.null(),
  handler: async (ctx, { messageId }) => {
    const message = await requireOwnMessage(ctx, messageId);
    if (!isWorking(message)) return null;
    await closeRendering(ctx, message);
    const now = Date.now();
    await ctx.db.patch("aiMessages", messageId, {
      status: "stopped",
      rendering: undefined,
      pendingResults: undefined,
      finishedAt: now,
      updatedAt: now,
    });
    return null;
  },
});

/** Runs the latest reply's failed request again. */
export const retry = mutation({
  args: { messageId: v.id("aiMessages") },
  returns: v.null(),
  handler: async (ctx, { messageId }) => {
    const message = await requireOwnMessage(ctx, messageId);
    const latest = await latestMessage(ctx, message.designId);
    if (latest?._id !== messageId || !canRetry(message))
      throw new ConvexError(errors.notFound);
    if (!aiConfig().configured) throw new ConvexError(errors.aiUnavailable);
    await ctx.db.patch("aiMessages", messageId, {
      status: "pending",
      error: undefined,
      finishedAt: undefined,
      updatedAt: Date.now(),
    });
    await ctx.scheduler.runAfter(0, internal.ai.run.step, { messageId });
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
