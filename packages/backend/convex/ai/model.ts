import Anthropic from "@anthropic-ai/sdk";
import type {
  BetaMessage,
  BetaMessageStreamParams,
  BetaRawMessageStreamEvent,
} from "@anthropic-ai/sdk/resources/beta/messages";
import { env } from "../_generated/server";
import { type AiConfig, REQUEST_TIME_LIMIT_MS } from "./config";
import { standIn } from "./standIn";

/**
 * Who answers the AI designer's requests: the Anthropic API, the local
 * stand-in (standIn.ts) on a development backend, or a test's fake.
 */
export interface ModelClient {
  /**
   * Makes one Messages API request, streamed: each event as it arrives,
   * then the whole message. Rejects when `signal` aborts.
   */
  stream(
    request: BetaMessageStreamParams,
    onEvent: (event: BetaRawMessageStreamEvent) => void,
    signal: AbortSignal,
  ): Promise<BetaMessage>;
}

/** The Anthropic API, through its SDK. */
function anthropic(apiKey: string): ModelClient {
  const client = new Anthropic({
    apiKey,
    // A request must end inside its Convex action; the SDK still retries
    // connection errors, 429s and 5xx before the stream starts.
    timeout: REQUEST_TIME_LIMIT_MS,
    maxRetries: 2,
  });
  return {
    async stream(request, onEvent, signal) {
      const stream = client.beta.messages.stream(request, { signal });
      stream.on("streamEvent", (event) => onEvent(event));
      return await stream.finalMessage();
    },
  };
}

let testClient: ModelClient | undefined;

/** Lets a test answer for the model; nothing else sets it. */
export function setTestModelClient(client: ModelClient | undefined) {
  testClient = client;
}

/** The client this deployment's requests go to, or null when it has none. */
export function modelClient(config: AiConfig): ModelClient | null {
  if (testClient) return testClient;
  if (config.standIn) return standIn;
  const apiKey = env.ANTHROPIC_API_KEY?.trim();
  return apiKey ? anthropic(apiKey) : null;
}
