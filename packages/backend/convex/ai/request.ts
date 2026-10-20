import type {
  BetaContentBlock,
  BetaContentBlockParam,
  BetaMessage,
  BetaMessageParam,
  BetaMessageStreamParams,
} from "@anthropic-ai/sdk/resources/beta/messages";
import { type AiConfig, MAX_TOKENS } from "./config";
import { SYSTEM_PROMPT } from "./prompt";
import { tools } from "./tools";

/**
 * The Messages API request the AI designer makes, and what it keeps of the
 * answer. Pure, so tests can check every request without a network.
 */

const betas = [
  // `fallbacks: "default"`: a request the model declines on policy grounds
  // runs again, in the same call, on the model Anthropic recommends for it.
  "server-side-fallback-2026-07-01",
  // The model's short notes between tool calls come back as text.
  "thinking-display-updates-2026-08-18",
  // Lets the request say what happens to thinking blocks that no longer
  // match their conversation (thinking.block_binding).
  "thinking-binding-controls-2026-08-01",
];

/**
 * The request for the next round of a thread. The system prompt, the tools
 * and every earlier message are byte for byte what the thread's first
 * request sent, so the API serves them from its cache and keeps the model's
 * earlier thinking.
 */
export function buildRequest(
  config: AiConfig,
  messages: BetaMessageParam[],
  options: { userId: string; wrapUp: boolean },
): BetaMessageStreamParams {
  return {
    model: config.model,
    max_tokens: MAX_TOKENS,
    betas,
    fallbacks: "default",
    thinking: {
      type: "adaptive",
      display: "updates",
      // The history is append-only, so no block should ever fail its check;
      // if one does, the request goes on without it rather than failing.
      block_binding: { prefix_mismatch_behavior: "drop_block" },
    },
    output_config: { effort: "xhigh" },
    system: [
      {
        type: "text",
        text: SYSTEM_PROMPT,
        cache_control: { type: "ephemeral" },
      },
    ],
    tools,
    // At the round limit the model writes its reply without more changes;
    // the tools stay declared, so nothing earlier in the thread changes.
    tool_choice: { type: options.wrapUp ? "none" : "auto" },
    // Caches the conversation so far, moving forward with each round.
    cache_control: { type: "ephemeral" },
    metadata: { user_id: options.userId },
    messages,
  };
}

/** FNV-1a, enough to tell one prompt from the next. */
function hash(text: string): string {
  let value = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    value ^= text.charCodeAt(i);
    value = Math.imul(value, 0x01000193);
  }
  return (value >>> 0).toString(36);
}

/**
 * What a thread's requests are made with. A thread goes on only while this
 * stays the same; a deploy that changes it starts the next message afresh.
 */
export function promptVersion(config: AiConfig): string {
  return hash(
    JSON.stringify([config.model, config.standIn, SYSTEM_PROMPT, tools, betas]),
  );
}

/** Where the answer's last fallback block is, or -1 without one. */
function lastFallback(content: BetaContentBlock[]): number {
  for (let index = content.length - 1; index >= 0; index--)
    if (content[index]?.type === "fallback") return index;
  return -1;
}

/**
 * The answer's content as it goes back on later requests. After a fallback
 * mid-answer, the declined model's thinking and unfinished tool calls before
 * the last fallback block are left out (its text stays), as the API asks;
 * everything else goes back exactly as received.
 */
export function echoable(content: BetaContentBlock[]): BetaContentBlockParam[] {
  const boundary = lastFallback(content);
  return content.filter(
    (block, index) =>
      index >= boundary ||
      (block.type !== "thinking" &&
        block.type !== "redacted_thinking" &&
        block.type !== "tool_use" &&
        block.type !== "server_tool_use"),
  ) as BetaContentBlockParam[];
}

/** The tool calls to run: those after the last fallback block, if any. */
export function toolCalls(content: BetaContentBlock[]) {
  const boundary = lastFallback(content);
  return content
    .slice(boundary + 1)
    .filter((block) => block.type === "tool_use");
}

/** Sent in place of a progress note when the model's work was cut off. */
export const INTERRUPTED =
  "This part of the response was interrupted before it finished.";

/** The text the couple reads: the answer's text blocks. */
export function replyText(content: BetaContentBlock[]): string {
  return content
    .flatMap((block) => (block.type === "text" ? [block.text.trim()] : []))
    .filter(Boolean)
    .join("\n\n");
}

/**
 * The thinking blocks the API didn't read as sent back (block_binding
 * drop_block): each entry of input_transformations, with where the block
 * was in the request and why. The array is empty when the thread was intact.
 */
export function droppedThinking(
  answer: BetaMessage,
): { type: string; path: string; reason: string }[] {
  return (answer.input_transformations ?? []).map(({ type, path, reason }) => ({
    type,
    path,
    reason,
  }));
}

/** The model's short notes between tool calls (non-empty thinking blocks). */
export function progressNotes(content: BetaContentBlock[]): string[] {
  return content.flatMap((block) =>
    block.type === "thinking" &&
    block.thinking.trim() &&
    block.thinking.trim() !== INTERRUPTED
      ? [block.thinking.trim()]
      : [],
  );
}

export interface Usage {
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite: number;
}

/**
 * What the answer cost. With a fallback, each attempt bills separately and
 * `usage.iterations` lists them; otherwise the top-level usage is the bill.
 */
export function usageOf(message: BetaMessage): {
  usage: Usage;
  /** Tokens the request read: how long its thread has grown. */
  contextTokens: number;
  /** The model that answered, when a fallback stood in. */
  servedBy?: string;
} {
  const attempts = (message.usage.iterations ?? []).filter(
    (entry) => entry.type === "message" || entry.type === "fallback_message",
  );
  const counted = attempts.length > 0 ? attempts : [message.usage];
  const usage = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 };
  for (const entry of counted) {
    usage.input += entry.input_tokens;
    usage.output += entry.output_tokens;
    usage.cacheRead += entry.cache_read_input_tokens ?? 0;
    usage.cacheWrite += entry.cache_creation_input_tokens ?? 0;
  }
  const last = counted.at(-1) ?? message.usage;
  const fallback = attempts.some((entry) => entry.type === "fallback_message");
  return {
    usage,
    contextTokens:
      last.input_tokens +
      (last.cache_read_input_tokens ?? 0) +
      (last.cache_creation_input_tokens ?? 0),
    ...(fallback && message.stop_reason !== "refusal"
      ? { servedBy: message.model }
      : {}),
  };
}

export function addUsage(a: Usage | undefined, b: Usage): Usage {
  return {
    input: (a?.input ?? 0) + b.input,
    output: (a?.output ?? 0) + b.output,
    cacheRead: (a?.cacheRead ?? 0) + b.cacheRead,
    cacheWrite: (a?.cacheWrite ?? 0) + b.cacheWrite,
  };
}
