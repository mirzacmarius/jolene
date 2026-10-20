import Anthropic from "@anthropic-ai/sdk";
import type {
  BetaContentBlockParam,
  BetaMessage,
  BetaMessageParam,
  BetaRawMessageStreamEvent,
  BetaToolResultBlockParam,
  BetaToolUseBlock,
} from "@anthropic-ai/sdk/resources/beta/messages";
import {
  type DesignDocument,
  fieldProblem,
  previewFields,
} from "@jolene/design";
import { type Infer, v } from "convex/values";
import { internal } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";
import {
  type ActionCtx,
  internalAction,
  internalMutation,
  type MutationCtx,
} from "../_generated/server";
import { applyToDesign } from "../designs/apply";
import {
  aiConfig,
  MAX_ROUNDS,
  RENDERING_TIMEOUT_MS,
  REQUEST_TIME_LIMIT_MS,
  WRITE_INTERVAL_MS,
} from "./config";
import { compactDocument, detailsKey } from "./context";
import { modelClient } from "./model";
import { layoutReport } from "./report";
import {
  addUsage,
  buildRequest,
  echoable,
  progressNotes,
  replyText,
  toolCalls,
  usageOf,
} from "./request";
import { applyOperationsInput, setDetailsInput, toolNames } from "./tools";
import type { aiChangeValidator, aiErrorValidator } from "./validators";

/**
 * A reply runs as a chain of steps, each one Messages API request in its own
 * action: the step streams the answer into the message, then `finish` keeps
 * it, runs the tools it called and schedules the next step, in one
 * transaction. Stopping, a failed request or the round limit end the chain.
 */

type Change = Infer<typeof aiChangeValidator>;
type Failure = Infer<typeof aiErrorValidator>;
type ToolResult = BetaToolResultBlockParam;

/** A stopped or crashed step leaves no reply waiting longer than this. */
const WATCHDOG_MS = 10.5 * 60_000;

/** What a reply had written before the current round. */
const baseValidator = v.object({
  text: v.string(),
  notes: v.array(v.string()),
});
type Base = Infer<typeof baseValidator>;

/** Whether the reply still streams this round: not stopped, not moved on. */
const inRound = (
  message: Doc<"aiMessages"> | null,
  round: number,
): message is Doc<"aiMessages"> =>
  message?.status === "streaming" && message.rounds === round;

/** Starts a round: marks the reply as streaming and hands over its thread. */
export const begin = internalMutation({
  args: { messageId: v.id("aiMessages") },
  returns: v.union(
    v.null(),
    v.object({
      round: v.number(),
      ownerId: v.id("users"),
      base: baseValidator,
      turns: v.array(
        v.object({
          role: v.union(v.literal("user"), v.literal("assistant")),
          content: v.string(),
        }),
      ),
    }),
  ),
  handler: async (ctx, { messageId }) => {
    const message = await ctx.db.get("aiMessages", messageId);
    if (
      !message ||
      (message.status !== "pending" && message.status !== "streaming")
    )
      return null;
    const round = (message.rounds ?? 0) + 1;
    await ctx.db.patch("aiMessages", messageId, {
      status: "streaming",
      rounds: round,
      updatedAt: Date.now(),
    });
    await ctx.scheduler.runAfter(WATCHDOG_MS, internal.ai.run.watchdog, {
      messageId,
      round,
    });
    const turns = await ctx.db
      .query("aiTurns")
      .withIndex("by_designId_and_thread", (q) =>
        q.eq("designId", message.designId).eq("thread", message.thread),
      )
      .take(4000);
    return {
      round,
      ownerId: message.ownerId,
      base: { text: message.text, notes: message.notes ?? [] },
      turns: turns.map(({ role, content }) => ({ role, content })),
    };
  },
});

/**
 * Saves what the round has written so far. False when the reply is no
 * longer wanted (stopped, or a newer round runs), which stops the stream.
 */
export const progress = internalMutation({
  args: {
    messageId: v.id("aiMessages"),
    round: v.number(),
    text: v.string(),
    notes: v.array(v.string()),
  },
  returns: v.boolean(),
  handler: async (ctx, { messageId, round, text, notes }) => {
    const message = await ctx.db.get("aiMessages", messageId);
    if (!inRound(message, round)) return false;
    await ctx.db.patch("aiMessages", messageId, {
      text,
      notes,
      updatedAt: Date.now(),
    });
    return true;
  },
});

/** One Messages API request of a reply; see the top of this file. */
export const step = internalAction({
  args: {
    messageId: v.id("aiMessages"),
    /** Requests re-issued in a row because a tool input was not JSON. */
    attempt: v.optional(v.number()),
  },
  returns: v.null(),
  handler: async (ctx, { messageId, attempt = 0 }) => {
    const run = await ctx.runMutation(internal.ai.run.begin, { messageId });
    if (!run) return null;
    const { round, base } = run;
    const config = aiConfig();
    const client = modelClient(config);
    if (!client) {
      await ctx.runMutation(internal.ai.run.fail, {
        messageId,
        round,
        base,
        error: "unavailable",
      });
      return null;
    }
    const writer = new ReplyWriter(ctx, messageId, round, base);
    const timer = setTimeout(() => writer.abort(), REQUEST_TIME_LIMIT_MS);
    try {
      const messages = await hydrate(ctx, run.turns);
      const request = buildRequest(config, messages, {
        userId: run.ownerId,
        wrapUp: round > MAX_ROUNDS,
      });
      const answer = await client.stream(
        request,
        writer.onEvent,
        writer.signal,
      );
      await writer.settle();
      if (!writer.wanted) return null;
      await ctx.runMutation(internal.ai.run.finish, {
        messageId,
        round,
        base,
        answer: JSON.stringify(answer),
      });
    } catch (error) {
      await writer.settle();
      if (!writer.wanted) return null;
      // The SDK raises its own error, not an API error, for a tool input that
      // streamed in but isn't JSON (eager input streaming), and for a stream
      // that broke off: the request is made again, at most twice.
      const unfinished =
        error instanceof Anthropic.AnthropicError &&
        !(error instanceof Anthropic.APIError) &&
        !writer.timedOut;
      if (unfinished && attempt < 2) {
        await ctx.runMutation(internal.ai.run.progress, {
          messageId,
          round,
          ...base,
        });
        await ctx.scheduler.runAfter(0, internal.ai.run.step, {
          messageId,
          attempt: attempt + 1,
        });
        return null;
      }
      const failure = failureOf(error, writer.timedOut);
      await ctx.runMutation(internal.ai.run.fail, {
        messageId,
        round,
        base,
        error: failure,
      });
    } finally {
      clearTimeout(timer);
    }
    return null;
  },
});

/** What the couple is told about a request that failed; logged without secrets. */
function failureOf(error: unknown, timedOut: boolean): Failure {
  if (timedOut) {
    console.error("AI designer request ran past its time limit");
    return "failed";
  }
  // Connection errors are API errors too, so they're told apart first.
  if (error instanceof Anthropic.APIConnectionError) {
    console.error("AI designer request could not connect:", error.message);
    return "busy";
  }
  if (error instanceof Anthropic.APIError) {
    console.error(
      `AI designer request failed with ${error.status ?? "no status"}:`,
      error.message,
      error.requestID ?? "",
    );
    if (
      error instanceof Anthropic.AuthenticationError ||
      error instanceof Anthropic.PermissionDeniedError ||
      error instanceof Anthropic.NotFoundError
    )
      return "unavailable";
    if (
      error instanceof Anthropic.RateLimitError ||
      error instanceof Anthropic.InternalServerError
    )
      return "busy";
    return "failed";
  }
  console.error(
    "AI designer request failed:",
    error instanceof Error ? error.message : String(error),
  );
  return "failed";
}

/**
 * Writes the round into the message as it streams, at most every
 * WRITE_INTERVAL_MS, so the studio shows the reply being written and the
 * short notes the model makes between tool calls.
 */
class ReplyWriter {
  private readonly controller = new AbortController();
  readonly signal = this.controller.signal;
  wanted = true;
  timedOut = false;
  private text = "";
  private readonly notes: string[] = [];
  private lastWrite = 0;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private writes: Promise<void> = Promise.resolve();

  constructor(
    private readonly ctx: ActionCtx,
    private readonly messageId: Id<"aiMessages">,
    private readonly round: number,
    private readonly base: Base,
  ) {}

  onEvent = (event: BetaRawMessageStreamEvent) => {
    if (event.type === "content_block_start") {
      if (event.content_block.type === "thinking") this.notes.push("");
      else if (event.content_block.type === "text" && this.text)
        this.text += "\n\n";
      return;
    }
    if (event.type !== "content_block_delta") return;
    if (event.delta.type === "text_delta") this.text += event.delta.text;
    else if (event.delta.type === "thinking_delta" && this.notes.length > 0)
      this.notes[this.notes.length - 1] += event.delta.thinking;
    else return;
    this.schedule();
  };

  abort() {
    this.timedOut = true;
    this.controller.abort();
  }

  private schedule() {
    if (this.timer || !this.wanted) return;
    const wait = Math.max(0, this.lastWrite + WRITE_INTERVAL_MS - Date.now());
    this.timer = setTimeout(() => {
      this.timer = undefined;
      this.write();
    }, wait);
  }

  private write() {
    const text = [this.base.text, this.text.trim()]
      .filter(Boolean)
      .join("\n\n");
    const notes = [
      ...this.base.notes,
      ...this.notes.map((note) => note.trim()).filter(Boolean),
    ];
    this.writes = this.writes.then(async () => {
      try {
        const wanted = await this.ctx.runMutation(internal.ai.run.progress, {
          messageId: this.messageId,
          round: this.round,
          text,
          notes,
        });
        this.lastWrite = Date.now();
        if (!wanted && this.wanted) {
          this.wanted = false;
          this.controller.abort();
        }
      } catch (error) {
        // The next write, or the round's end, saves the text instead.
        console.error(
          "AI designer progress write failed:",
          error instanceof Error ? error.message : String(error),
        );
      }
    });
  }

  /** Waits for the writes in flight; pending ones are dropped. */
  async settle() {
    clearTimeout(this.timer);
    this.timer = undefined;
    await this.writes;
  }
}

/** A stored image block: the file stands in for its bytes until sent. */
interface StoredImage {
  type: "image";
  source: { type: "stored"; storageId: Id<"_storage"> };
}

/** A tool result as kept in a thread: its images may be stored files. */
export type StoredToolResult = Omit<ToolResult, "content"> & {
  content?:
    | string
    | (
        | Exclude<ToolResult["content"], string | undefined>[number]
        | StoredImage
      )[];
};

export function storedImage(storageId: Id<"_storage">): StoredImage {
  return { type: "image", source: { type: "stored", storageId } };
}

/** The image type a file's first bytes show: PNG and JPEG are sent. */
export function imageType(
  bytes: Uint8Array,
): "image/png" | "image/jpeg" | null {
  if (
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47
  )
    return "image/png";
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff)
    return "image/jpeg";
  return null;
}

function base64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000)
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary);
}

/**
 * The thread as the API reads it: each turn's JSON, with stored images read
 * back into their bytes. The same file gives the same block every time, so
 * the conversation stays byte for byte what it was; a file that is gone or
 * isn't a PNG or JPEG becomes a short note instead.
 */
async function hydrate(
  ctx: ActionCtx,
  turns: { role: "user" | "assistant"; content: string }[],
): Promise<BetaMessageParam[]> {
  const files = new Map<string, Promise<unknown>>();
  const read = (storageId: Id<"_storage">) => {
    let file = files.get(storageId);
    if (!file) {
      file = ctx.storage.get(storageId).then(async (blob) => {
        if (!blob)
          return { type: "text", text: "(This image is no longer available.)" };
        const bytes = new Uint8Array(await blob.arrayBuffer());
        const mediaType = imageType(bytes);
        return mediaType
          ? {
              type: "image",
              source: {
                type: "base64",
                media_type: mediaType,
                data: base64(bytes),
              },
            }
          : { type: "text", text: "(This file is not an image you can read.)" };
      });
      files.set(storageId, file);
    }
    return file;
  };
  const resolve = async (block: unknown): Promise<unknown> => {
    const image = block as Partial<StoredImage>;
    if (image.type === "image" && image.source?.type === "stored")
      return await read(image.source.storageId);
    const result = block as Partial<ToolResult>;
    if (result.type === "tool_result" && Array.isArray(result.content))
      return {
        ...result,
        content: await Promise.all(result.content.map(resolve)),
      };
    return block;
  };
  return await Promise.all(
    turns.map(async (turn) => ({
      role: turn.role,
      content: (await Promise.all(
        (JSON.parse(turn.content) as unknown[]).map(resolve),
      )) as BetaContentBlockParam[],
    })),
  );
}

/** Ends a round that failed, keeping what earlier rounds wrote. */
export const fail = internalMutation({
  args: {
    messageId: v.id("aiMessages"),
    round: v.number(),
    base: baseValidator,
    error: v.union(
      v.literal("refused"),
      v.literal("busy"),
      v.literal("unavailable"),
      v.literal("failed"),
    ),
  },
  returns: v.null(),
  handler: async (ctx, { messageId, round, base, error }) => {
    const message = await ctx.db.get("aiMessages", messageId);
    if (!inRound(message, round)) return null;
    const now = Date.now();
    await ctx.db.patch("aiMessages", messageId, {
      ...base,
      status: "failed",
      error,
      finishedAt: now,
      updatedAt: now,
    });
    return null;
  },
});

/** Fails a reply whose step died without a word (its action was cut off). */
export const watchdog = internalMutation({
  args: { messageId: v.id("aiMessages"), round: v.number() },
  returns: v.null(),
  handler: async (ctx, { messageId, round }) => {
    const message = await ctx.db.get("aiMessages", messageId);
    if (!inRound(message, round)) return null;
    const now = Date.now();
    await ctx.db.patch("aiMessages", messageId, {
      status: "failed",
      error: "failed",
      finishedAt: now,
      updatedAt: now,
    });
    return null;
  },
});

const toolError = (id: string, content: unknown): ToolResult => ({
  type: "tool_result",
  tool_use_id: id,
  is_error: true,
  content: typeof content === "string" ? content : JSON.stringify(content),
});

/** The tool input as received, for a model to correct (eager streaming). */
const invalidInput = (call: BetaToolUseBlock, problems: string) =>
  toolError(call.id, {
    INVALID_JSON: JSON.stringify(call.input),
    problems,
  });

interface Outcome {
  result: ToolResult;
  change?: Change;
  seen?: Partial<{ revision: number; details: string }>;
}

/** apply_operations: the editor's path, as its own version by "ai". */
async function applyOperationsTool(
  ctx: MutationCtx,
  message: Doc<"aiMessages">,
  call: BetaToolUseBlock,
): Promise<Outcome> {
  const input = applyOperationsInput.safeParse(call.input);
  if (!input.success)
    return { result: invalidInput(call, input.error.message) };
  const design = await ctx.db.get("designs", message.designId);
  if (!design)
    return { result: toolError(call.id, "The design no longer exists.") };
  const applied = await applyToDesign(ctx, design, input.data.operations, {
    author: "ai",
    note: input.data.note,
    expectedRevision: input.data.revision,
  });
  if (!applied.ok)
    return {
      result: toolError(call.id, {
        error: applied.reason,
        message:
          applied.reason === "stale"
            ? `${applied.message}: the couple changed it meanwhile. Nothing was applied; build your change on the design below.`
            : `${applied.message}. Nothing was applied.`,
        revision: applied.revision,
        design: compactDocument(design.document as DesignDocument),
      }),
      seen: { revision: applied.revision },
    };
  const event = await ctx.db.get("events", design.eventId);
  const report = layoutReport(
    applied.document,
    previewFields(
      applied.document.occasion,
      applied.document.language,
      event?.fields ?? {},
    ),
  );
  return {
    result: {
      type: "tool_result",
      tool_use_id: call.id,
      content: JSON.stringify({
        revision: applied.revision,
        textFit: report.layers,
        measuredWith: report.measuredWith,
      }),
    },
    change: {
      kind: "design",
      revision: applied.revision,
      note: input.data.note,
    },
    seen: { revision: applied.revision },
  };
}

/** set_details: the couple's details on their event, checked like the editor's. */
async function setDetailsTool(
  ctx: MutationCtx,
  message: Doc<"aiMessages">,
  call: BetaToolUseBlock,
): Promise<Outcome> {
  const input = setDetailsInput.safeParse(call.input);
  if (!input.success)
    return { result: invalidInput(call, input.error.message) };
  const design = await ctx.db.get("designs", message.designId);
  const event = design && (await ctx.db.get("events", design.eventId));
  if (!event)
    return { result: toolError(call.id, "The design no longer exists.") };
  const problems = Object.fromEntries(
    Object.entries(input.data.fields).flatMap(([key, value]) => {
      const problem = fieldProblem(event.occasion, key, value);
      return problem ? [[key, problem]] : [];
    }),
  );
  if (Object.keys(problems).length > 0)
    return {
      result: toolError(call.id, {
        error: "invalid",
        message:
          'Nothing was saved. "unknown": the occasion has no such detail; "date": write YYYY-MM-DD; "time": write HH:MM; "too-long": shorten it.',
        problems,
      }),
    };
  const fields = { ...event.fields };
  const previous: Record<string, string> = {};
  for (const [key, value] of Object.entries(input.data.fields)) {
    previous[key] = event.fields[key] ?? "";
    if (value === "") delete fields[key];
    else fields[key] = value;
  }
  await ctx.db.patch("events", event._id, { fields, updatedAt: Date.now() });
  return {
    result: {
      type: "tool_result",
      tool_use_id: call.id,
      content: JSON.stringify({ saved: input.data.fields }),
    },
    change: { kind: "details", previous, note: input.data.note },
    seen: { details: detailsKey(fields) },
  };
}

/** Told to the model when it has used up the rounds of one reply. */
const WRAP_UP =
  "You have made as many requests as one reply allows. Don't call more tools now: tell the couple briefly what you changed and what is left, and they can ask you to go on.";

/**
 * Keeps the round's answer, runs the tools it called and schedules the next
 * round, all in one transaction. A round the couple stopped is dropped.
 */
export const finish = internalMutation({
  args: {
    messageId: v.id("aiMessages"),
    round: v.number(),
    base: baseValidator,
    /** The API's message, as JSON. */
    answer: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, { messageId, round, base, answer: json }) => {
    const message = await ctx.db.get("aiMessages", messageId);
    if (!inRound(message, round)) return null;
    const answer = JSON.parse(json) as BetaMessage;
    const now = Date.now();
    const { usage, contextTokens, servedBy } = usageOf(answer);
    const accounted = {
      usage: addUsage(message.usage, usage),
      contextTokens,
      ...(servedBy ? { servedBy } : {}),
      updatedAt: now,
    };
    if (
      answer.stop_reason === "refusal" ||
      answer.stop_reason === "model_context_window_exceeded"
    ) {
      // A declined answer is dropped, partial text and all, and the thread
      // ends with it: the next message starts afresh, without the request.
      await ctx.db.patch("aiMessages", messageId, {
        ...accounted,
        ...base,
        status: "failed",
        error: answer.stop_reason === "refusal" ? "refused" : "failed",
        endsThread: true,
        finishedAt: now,
      });
      return null;
    }

    await ctx.db.insert("aiTurns", {
      designId: message.designId,
      thread: message.thread,
      messageId,
      role: "assistant",
      content: JSON.stringify(echoable(answer.content)),
    });
    const written = {
      text: [base.text, replyText(answer.content)].filter(Boolean).join("\n\n"),
      notes: [...base.notes, ...progressNotes(answer.content)].slice(-20),
    };
    const next = () =>
      ctx.scheduler.runAfter(0, internal.ai.run.step, { messageId });
    const userTurn = (content: unknown[]) =>
      ctx.db.insert("aiTurns", {
        designId: message.designId,
        thread: message.thread,
        messageId,
        role: "user",
        content: JSON.stringify(content),
      });

    // A server-side pause: the same request goes on from where it stopped.
    if (answer.stop_reason === "pause_turn" && round <= MAX_ROUNDS) {
      await ctx.db.patch("aiMessages", messageId, { ...accounted, ...written });
      await next();
      return null;
    }

    const calls = toolCalls(answer.content);
    if (calls.length === 0 || round > MAX_ROUNDS) {
      // A reply cut off at max_tokens goes on in another round.
      if (answer.stop_reason === "max_tokens" && round < MAX_ROUNDS) {
        await userTurn([
          {
            type: "text",
            text: "Your reply was cut off; go on from where it stopped.",
          },
        ]);
        await ctx.db.patch("aiMessages", messageId, {
          ...accounted,
          ...written,
        });
        await next();
        return null;
      }
      // Calls past the round limit don't run, but get their results, so
      // the thread stays one the API reads.
      if (calls.length > 0)
        await userTurn(
          calls.map((call) =>
            toolError(call.id, "This call came after the reply's last round."),
          ),
        );
      await ctx.db.patch("aiMessages", messageId, {
        ...accounted,
        ...written,
        status: "done",
        finishedAt: now,
      });
      return null;
    }

    const results: (ToolResult | null)[] = [];
    const changes = [...(message.changes ?? [])];
    let seen = message.seen;
    let rendering: string | undefined;
    for (const call of calls) {
      // An input cut off at max_tokens can still look whole: don't run it.
      if (answer.stop_reason === "max_tokens") {
        results.push(
          toolError(
            call.id,
            "Your answer was cut off before this call was complete, so it did not run. Make the change again in smaller steps.",
          ),
        );
        continue;
      }
      let outcome: Outcome;
      switch (call.name) {
        case toolNames.applyOperations:
          outcome = await applyOperationsTool(ctx, message, call);
          break;
        case toolNames.setDetails:
          outcome = await setDetailsTool(ctx, message, call);
          break;
        case toolNames.lookAtDesign:
          if (rendering === undefined) {
            rendering = call.id;
            results.push(null);
            continue;
          }
          outcome = {
            result: {
              type: "tool_result",
              tool_use_id: call.id,
              content:
                "The rendering for your other look_at_design call answers this one too.",
            },
          };
          break;
        default:
          outcome = {
            result: toolError(
              call.id,
              `There is no tool named "${call.name}".`,
            ),
          };
      }
      results.push(outcome.result);
      if (outcome.change) changes.push(outcome.change);
      if (outcome.seen)
        seen = {
          revision: outcome.seen.revision ?? seen?.revision ?? 0,
          details: outcome.seen.details ?? seen?.details ?? "{}",
        };
    }
    const kept = {
      ...accounted,
      ...written,
      changes,
      ...(seen ? { seen } : {}),
    };

    if (rendering !== undefined) {
      const design = await ctx.db.get("designs", message.designId);
      await ctx.db.patch("aiMessages", messageId, {
        ...kept,
        status: "rendering",
        rendering: { toolUseId: rendering, revision: design?.revision ?? 0 },
        pendingResults: JSON.stringify(results),
      });
      await ctx.scheduler.runAfter(
        RENDERING_TIMEOUT_MS,
        internal.ai.run.renderingTimedOut,
        { messageId, toolUseId: rendering },
      );
      return null;
    }
    await userTurn(roundResults(results as ToolResult[], round));
    await ctx.db.patch("aiMessages", messageId, kept);
    await next();
    return null;
  },
});

/** A round's tool results, with the wrap-up request on the last round. */
function roundResults(results: StoredToolResult[], round: number): unknown[] {
  return round >= MAX_ROUNDS
    ? [...results, { type: "text", text: WRAP_UP }]
    : results;
}

/** The round's tool results, the awaited rendering's among them. */
function renderingRound(
  message: Doc<"aiMessages">,
  rendering: StoredToolResult,
): StoredToolResult[] {
  return (
    JSON.parse(message.pendingResults ?? "[]") as (ToolResult | null)[]
  ).map((result) => result ?? rendering);
}

/**
 * Hands the awaited rendering's result to the reply, with the round's other
 * results, and lets it go on.
 */
export async function resumeWithRendering(
  ctx: MutationCtx,
  message: Doc<"aiMessages">,
  rendering: StoredToolResult,
) {
  await ctx.db.insert("aiTurns", {
    designId: message.designId,
    thread: message.thread,
    messageId: message._id,
    role: "user",
    content: JSON.stringify(
      roundResults(renderingRound(message, rendering), message.rounds ?? 0),
    ),
  });
  await ctx.db.patch("aiMessages", message._id, {
    status: "streaming",
    rendering: undefined,
    pendingResults: undefined,
    updatedAt: Date.now(),
  });
  await ctx.scheduler.runAfter(0, internal.ai.run.step, {
    messageId: message._id,
  });
}

/**
 * Before a reply that waits for a rendering is stopped: the round's calls
 * still get their results, so its thread can go on with the next message.
 */
export async function closeRendering(
  ctx: MutationCtx,
  message: Doc<"aiMessages">,
) {
  if (message.status !== "rendering" || !message.rendering) return;
  const stopped = toolError(
    message.rendering.toolUseId,
    "The couple stopped you before the studio showed the design.",
  );
  await ctx.db.insert("aiTurns", {
    designId: message.designId,
    thread: message.thread,
    messageId: message._id,
    role: "user",
    content: JSON.stringify(renderingRound(message, stopped)),
  });
}

/** No studio showed the design in time: the reply goes on without it. */
export const renderingTimedOut = internalMutation({
  args: { messageId: v.id("aiMessages"), toolUseId: v.string() },
  returns: v.null(),
  handler: async (ctx, { messageId, toolUseId }) => {
    const message = await ctx.db.get("aiMessages", messageId);
    if (
      message?.status !== "rendering" ||
      message.rendering?.toolUseId !== toolUseId
    )
      return null;
    await resumeWithRendering(
      ctx,
      message,
      toolError(
        toolUseId,
        "No studio answered within 20 seconds (the couple may have closed the AI designer), so you can't see the design now. Carry on without it.",
      ),
    );
    return null;
  },
});
