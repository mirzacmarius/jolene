import {
  type DesignDocument,
  faceNames,
  fieldKeysUsed,
  type Language,
} from "@jolene/design";
import { internal } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { toneBrief } from "../simple/tones";
import { aiConfig, THREAD_TOKEN_LIMIT } from "./config";
import {
  type CompositionContext,
  detailsKey,
  messageContext,
  recap,
} from "./context";
import { promptVersion } from "./request";

/**
 * How the couple's words reach the AI designer: queued in the design's
 * conversation with the reply that answers them, then begun, once the thread
 * the reply goes on, the context it carries and its first request are
 * settled. Words the couple sends begin at once; a composition's later items
 * wait for its first item's reply (simple/compose.ts).
 */

/** Earlier messages a thread that starts afresh is told about. */
export const RECAP_MESSAGES = 24;

/** A reply still to be written, or being written. */
export const isWorking = (message: Doc<"aiMessages">) =>
  message.status === "waiting" ||
  message.status === "pending" ||
  message.status === "streaming" ||
  message.status === "rendering";

/** The design's newest message: a reply, since words never go unanswered. */
export async function latestMessage(ctx: QueryCtx, designId: Id<"designs">) {
  return await ctx.db
    .query("aiMessages")
    .withIndex("by_designId", (q) => q.eq("designId", designId))
    .order("desc")
    .first();
}

/** A reply that failed for a passing reason can run its request again. */
export const canRetry = (message: Doc<"aiMessages">) =>
  message.role === "designer" &&
  message.status === "failed" &&
  message.error !== "refused" &&
  !message.endsThread;

/** An image as a turn stores it: the file, read back when the turn is sent. */
export interface StoredImage {
  type: "image";
  source: { type: "stored"; storageId: Id<"_storage"> };
}

export function storedImage(storageId: Id<"_storage">): StoredImage {
  return { type: "image", source: { type: "stored", storageId } };
}

/** The view the studio named, if the design has it: "assembly" or "piece:face". */
export function shownView(view: string | undefined, document: DesignDocument) {
  if (!view || view === "assembly") return "assembly";
  const [piece, face] = view.split(":");
  const known = document.pieces.find((candidate) => candidate.id === piece);
  return known && faceNames.some((name) => name === face && known[name])
    ? view
    : "assembly";
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

/**
 * Puts the couple's words in the design's conversation with a reply to
 * them, which waits ("waiting") or is about to begin ("pending"). Nothing is
 * asked of the model until the reply begins.
 */
export async function queueReply(
  ctx: MutationCtx,
  {
    design,
    text,
    locale,
    snapshot,
    status,
    composition,
  }: {
    design: Doc<"designs">;
    text: string;
    locale: Language;
    snapshot?: Id<"_storage">;
    status: "waiting" | "pending";
    composition?: Id<"compositions">;
  },
): Promise<Doc<"aiMessages">> {
  const now = Date.now();
  // The conversation's current thread until the reply begins and settles
  // its own: a reply stopped before it began leaves no thread number taken.
  const thread = (await latestMessage(ctx, design._id))?.thread ?? 0;
  await ctx.db.insert("aiMessages", {
    designId: design._id,
    ownerId: design.ownerId,
    role: "couple",
    text,
    status: "done",
    thread,
    locale,
    ...(snapshot ? { snapshot } : {}),
    finishedAt: now,
    updatedAt: now,
  });
  const replyId = await ctx.db.insert("aiMessages", {
    designId: design._id,
    ownerId: design.ownerId,
    role: "designer",
    text: "",
    status,
    thread,
    locale,
    ...(composition ? { composition } : {}),
    updatedAt: now,
  });
  const reply = await ctx.db.get("aiMessages", replyId);
  if (!reply) throw new Error("The reply was just written");
  return reply;
}

/**
 * Begins a queued reply: settles the thread it goes on (a thread goes on
 * while the API can read it whole and as it was), writes the couple's turn
 * with the context of the design as it is now, and starts the first request.
 */
export async function beginReply(
  ctx: MutationCtx,
  reply: Doc<"aiMessages">,
  options: { view?: string; composition?: CompositionContext } = {},
) {
  const newest = await ctx.db
    .query("aiMessages")
    .withIndex("by_designId", (q) => q.eq("designId", reply.designId))
    .order("desc")
    .take(RECAP_MESSAGES + 2);
  const [last, sent, ...older] = newest;
  if (last?._id !== reply._id || sent?.role !== "couple")
    throw new Error("A reply begins right after the words it answers");
  const recent = older.reverse();
  const latest = recent.at(-1);

  const design = await ctx.db.get("designs", reply.designId);
  const event = design && (await ctx.db.get("events", design.eventId));
  const template = design && (await ctx.db.get("templates", design.templateId));
  const suite = template && (await ctx.db.get("suites", template.suiteId));
  if (!design || !event || !suite) throw new Error("The design is gone");
  const document = design.document as DesignDocument;
  const prompt = promptVersion(aiConfig());
  const details = detailsKey(event.fields);
  const locale = sent.locale ?? reply.locale ?? "ro";

  const goesOn =
    latest?.role === "designer" &&
    !latest.endsThread &&
    latest.prompt === prompt &&
    (latest.contextTokens ?? 0) <= THREAD_TOKEN_LIMIT;
  const thread = goesOn ? latest.thread : (latest?.thread ?? 0) + 1;
  const lastSent = [...recent]
    .reverse()
    .find((message) => message.role === "couple");
  const undone = recent.flatMap((message) =>
    (message.changes ?? []).flatMap((change) =>
      change.undoneAt !== undefined &&
      change.undoneAt > (lastSent?._creationTime ?? 0)
        ? [change.note]
        : [],
    ),
  );
  const wording = event.wording;
  const context = messageContext({
    locale,
    view: shownView(options.view, document),
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
    snapshot: Boolean(sent.snapshot),
    ...(wording
      ? {
          wording: {
            ...(wording.tone
              ? {
                  tone: {
                    id: wording.tone,
                    brief: toneBrief(wording.tone, event.occasion),
                  },
                }
              : {}),
            ...(wording.line ? { line: wording.line } : {}),
            language: wording.language,
          },
        }
      : {}),
    ...(options.composition ? { composition: options.composition } : {}),
  });

  const now = Date.now();
  await ctx.db.patch("aiMessages", sent._id, { thread });
  await ctx.db.insert("aiTurns", {
    designId: design._id,
    thread,
    messageId: sent._id,
    role: "user",
    content: JSON.stringify([
      { type: "text", text: context },
      ...(sent.snapshot ? [storedImage(sent.snapshot)] : []),
      { type: "text", text: sent.text },
    ]),
  });
  await ctx.db.patch("aiMessages", reply._id, {
    status: "pending",
    thread,
    prompt,
    seen: { revision: design.revision, details },
    updatedAt: now,
  });
  await ctx.scheduler.runAfter(0, internal.ai.run.step, {
    messageId: reply._id,
  });
}
