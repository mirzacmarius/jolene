import type {
  BetaContentBlock,
  BetaMessage,
  BetaMessageParam,
  BetaRawMessageStreamEvent,
  BetaStopReason,
} from "@anthropic-ai/sdk/resources/beta/messages";
import type { ModelClient } from "./model";
import { toolNames } from "./tools";

/**
 * A stand-in for the model, for a development backend with no key: set
 * AI_STAND_IN=1 on it (never on a real deployment) and the AI designer
 * answers every message with a short scripted turn. It notes what it is
 * doing, makes one apply_operations call that warms or cools the palette,
 * then says so; asked to look ("look", "uitați-vă"), it first calls
 * look_at_design. Enough to try the whole flow in the browser.
 */
export const standIn: ModelClient = {
  async stream(request, onEvent, signal) {
    const language =
      latest(request.messages, /<studio language="(\w+)"/) ?? "ro";
    const words = language === "en" ? english : romanian;
    const results = toolResults(request.messages);
    const calledLook = results.some((name) => name === toolNames.lookAtDesign);
    if (results.includes(toolNames.applyOperations))
      return await play([text(words.done)], "end_turn", onEvent, signal);
    const wantsLook =
      !calledLook &&
      /look|see|check|uita|uită|vede|verific/i.test(lastText(request.messages));
    if (wantsLook)
      return await play(
        [note(words.looking), toolUse(toolNames.lookAtDesign, {})],
        "tool_use",
        onEvent,
        signal,
      );
    const revision = Number(
      latest(request.messages, /revision"?[=:]"?(\d+)/) ?? 1,
    );
    const warm = revision % 2 === 1;
    return await play(
      [
        note(words.choosing),
        toolUse(toolNames.applyOperations, {
          revision,
          operations: [
            {
              op: "setPalette",
              palette: warm
                ? { accent: "#9a5b3f", art: "#b07a55" }
                : { accent: "#4f6b5d", art: "#7d9486" },
            },
          ],
          note: warm ? words.warmer : words.cooler,
        }),
      ],
      "tool_use",
      onEvent,
      signal,
    );
  },
};

const romanian = {
  looking: "Mă uit la design așa cum îl vedeți.",
  choosing: "Aleg o paletă nouă pentru accent și ilustrații.",
  warmer: "Culori mai calde",
  cooler: "Culori mai reci",
  done: "Gata: am schimbat paleta, iar accentul și ilustrațiile au acum un ton nou. Dacă nu vă place, apăsați „Anulează”.",
};

const english = {
  looking: "Looking at the design as you see it.",
  choosing: "Choosing a new palette for the accent and the artwork.",
  warmer: "Warmer colours",
  cooler: "Cooler colours",
  done: "Done: I've changed the palette, so the accent and the artwork have a new tone. If you don't like it, press Undo.",
};

/** Every text the request holds, newest last, tool results included. */
function texts(messages: BetaMessageParam[]): string[] {
  return messages.flatMap((message) =>
    typeof message.content === "string"
      ? [message.content]
      : message.content.flatMap((block) => {
          if (block.type === "text") return [block.text];
          if (block.type === "tool_result")
            return typeof block.content === "string"
              ? [block.content]
              : (block.content ?? []).flatMap((inner) =>
                  inner.type === "text" ? [inner.text] : [],
                );
          return [];
        }),
  );
}

function latest(messages: BetaMessageParam[], pattern: RegExp) {
  for (const value of texts(messages).reverse()) {
    const match = pattern.exec(value);
    if (match) return match[1];
  }
  return undefined;
}

function lastText(messages: BetaMessageParam[]): string {
  return texts(messages).at(-1) ?? "";
}

/** The tools whose results the last message carries. */
function toolResults(messages: BetaMessageParam[]): string[] {
  const last = messages.at(-1);
  if (!last || typeof last.content === "string") return [];
  const ids = last.content.flatMap((block) =>
    block.type === "tool_result" ? [block.tool_use_id] : [],
  );
  const calls = messages.flatMap((message) =>
    typeof message.content === "string"
      ? []
      : message.content.flatMap((block) =>
          block.type === "tool_use" ? [block] : [],
        ),
  );
  return ids.flatMap((id) => {
    const call = calls.find((candidate) => candidate.id === id);
    return call ? [call.name] : [];
  });
}

const text = (value: string): BetaContentBlock => ({
  type: "text",
  text: value,
  citations: null,
});

const note = (value: string): BetaContentBlock => ({
  type: "thinking",
  thinking: value,
  signature: "stand-in",
});

const toolUse = (name: string, input: unknown): BetaContentBlock => ({
  type: "tool_use",
  id: `toolu_standin_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`,
  name,
  input,
});

const pause = (ms: number, signal: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    if (signal.aborted) reject(new Error("Stopped"));
    const timer = setTimeout(resolve, ms);
    signal.addEventListener(
      "abort",
      () => {
        clearTimeout(timer);
        reject(new Error("Stopped"));
      },
      { once: true },
    );
  });

/**
 * Streams the blocks a few words at a time, as the API would, and returns
 * the message they make.
 */
export async function play(
  content: BetaContentBlock[],
  stopReason: BetaStopReason,
  onEvent: (event: BetaRawMessageStreamEvent) => void,
  signal: AbortSignal,
  pace = 60,
): Promise<BetaMessage> {
  for (const [index, block] of content.entries()) {
    const start =
      block.type === "text"
        ? { ...block, text: "" }
        : block.type === "thinking"
          ? { ...block, thinking: "" }
          : block;
    onEvent({ type: "content_block_start", index, content_block: start });
    const words =
      block.type === "text"
        ? block.text
        : block.type === "thinking"
          ? block.thinking
          : "";
    for (const piece of words.match(/\S+\s*/g) ?? []) {
      if (pace > 0) await pause(pace, signal);
      onEvent({
        type: "content_block_delta",
        index,
        delta:
          block.type === "text"
            ? { type: "text_delta", text: piece }
            : {
                type: "thinking_delta",
                thinking: piece,
                estimated_tokens: null,
              },
      });
    }
    onEvent({ type: "content_block_stop", index });
  }
  if (pace > 0) await pause(pace, signal);
  return {
    id: `msg_standin_${Date.now().toString(36)}`,
    type: "message",
    role: "assistant",
    model: "stand-in",
    content,
    stop_reason: stopReason,
    stop_sequence: null,
    stop_details: null,
    container: null,
    context_management: null,
    diagnostics: null,
    usage: {
      input_tokens: 0,
      output_tokens: 0,
      cache_creation_input_tokens: 0,
      cache_read_input_tokens: 0,
      cache_creation: null,
      fallback_credit: null,
      inference_geo: null,
      iterations: null,
      output_tokens_details: null,
      server_tool_use: null,
      service_tier: null,
      speed: null,
    },
  };
}
