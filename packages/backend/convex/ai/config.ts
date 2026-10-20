import { env } from "../_generated/server";

/**
 * How the AI designer runs on this deployment, from its environment (see
 * convex.config.ts). The key is read only where a request is made, and never
 * logged.
 */
export function aiConfig() {
  return {
    model: env.AI_MODEL?.trim() || "claude-opus-5-5",
    /** The local stand-in answers instead of the model (standIn.ts). */
    standIn: env.AI_STAND_IN === "1",
    configured:
      Boolean(env.ANTHROPIC_API_KEY?.trim()) || env.AI_STAND_IN === "1",
    dailyLimit: count(env.AI_DAILY_LIMIT, 20),
    totalDailyLimit: count(env.AI_DAILY_LIMIT_TOTAL, 200),
  };
}

export type AiConfig = ReturnType<typeof aiConfig>;

function count(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return value && Number.isInteger(parsed) && parsed >= 0 ? parsed : fallback;
}

/**
 * Room for the model's thinking and its reply in one request. Streaming
 * would allow more, but a request has to finish inside one Convex action
 * (ten minutes), and this many tokens take about that long to write.
 */
export const MAX_TOKENS = 32000;

/** Requests one reply may make before it has to wrap up. */
export const MAX_ROUNDS = 12;

/** How often the reply's text is saved while it streams. */
export const WRITE_INTERVAL_MS = 300;

/** How long a reply waits for the studio to show it the design. */
export const RENDERING_TIMEOUT_MS = 20_000;

/**
 * A request still running this long is cut off, before the action's own
 * ten-minute limit would end it without a word.
 */
export const REQUEST_TIME_LIMIT_MS = 9 * 60_000;

/**
 * A thread whose requests read more than this starts afresh with the next
 * message, with a recap: the cost of a request grows with its thread.
 */
export const THREAD_TOKEN_LIMIT = 100_000;

/** The longest message a couple can send. */
export const MAX_MESSAGE_LENGTH = 2000;

/** A snapshot larger than this is left out of the message. */
export const MAX_SNAPSHOT_BYTES = 3_750_000;

/** The UTC day a time falls in, as its first millisecond; limits are daily. */
export function startOfDay(time: number): number {
  const date = new Date(time);
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}
