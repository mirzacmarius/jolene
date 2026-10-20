import type {
  BetaContentBlock,
  BetaMessage,
  BetaMessageParam,
  BetaMessageStreamParams,
  BetaRawMessageStreamEvent,
  BetaStopReason,
} from "@anthropic-ai/sdk/resources/beta/messages";
import {
  type Language,
  type ProductKind,
  productKindLabels,
} from "@jolene/design";
import type { ModelClient } from "./model";
import { toolNames } from "./tools";

/**
 * A stand-in for the model, for a development backend with no key: set
 * AI_STAND_IN=1 on it (never on a real deployment) and the AI designer
 * answers every message with a short scripted turn. It notes what it is
 * doing, makes one apply_operations call that warms or cools the palette,
 * then says so; asked to look ("look", "uitați-vă"), it first calls
 * look_at_design, and asked about the details ("detalii", "details"), it
 * writes sample names into them with set_details instead. Asked by simple
 * mode to write an item of a collection, it writes a line in the chosen
 * tone and language, with the couple's details as tokens, into one of the
 * item's texts, makes room for it, and says so. Enough to try the whole
 * flow in the browser.
 */
export const standIn: ModelClient = {
  async stream(request, onEvent, signal) {
    const turn = standInTurn(request);
    return await play(turn.content, turn.stop, onEvent, signal);
  },
};

/** What the stand-in answers to a request, before it is streamed. */
export function standInTurn(request: BetaMessageStreamParams): {
  content: BetaContentBlock[];
  stop: BetaStopReason;
} {
  const language = latest(request.messages, /<studio language="(\w+)"/) ?? "ro";
  const words = language === "en" ? english : romanian;
  const results = toolResults(request.messages);
  const context = latestContext(request.messages);
  const composition = /<composition item="[^"]*" first="(true|false)">/.exec(
    context,
  );
  if (composition) {
    const kind = /<item kind="([\w-]+)"/.exec(context)?.[1];
    const item = itemLabel(kind, language === "en" ? "en" : "ro");
    if (results.includes(toolNames.applyOperations))
      return { content: [text(words.composed(item))], stop: "end_turn" };
    const change = composeChange(
      request.messages,
      context,
      composition[1] === "true",
    );
    if (change)
      return {
        content: [
          note(words.composing(item)),
          toolUse(toolNames.applyOperations, {
            ...change,
            note: words.wording,
          }),
        ],
        stop: "tool_use",
      };
  }
  const calledLook = results.some((name) => name === toolNames.lookAtDesign);
  if (results.includes(toolNames.applyOperations))
    return { content: [text(words.done)], stop: "end_turn" };
  if (results.includes(toolNames.setDetails))
    return { content: [text(words.named)], stop: "end_turn" };
  const wantsLook =
    !calledLook &&
    /look|see|check|uita|uită|vede|verific/i.test(lastText(request.messages));
  if (wantsLook)
    return {
      content: [note(words.looking), toolUse(toolNames.lookAtDesign, {})],
      stop: "tool_use",
    };
  if (/detali|details/i.test(lastText(request.messages))) {
    const occasion = latest(request.messages, /<details occasion="(\w+)"/);
    return {
      content: [
        note(words.naming),
        toolUse(toolNames.setDetails, {
          fields:
            occasion === "christening"
              ? { child: "Sofia" }
              : { partner1: "Ioana", partner2: "Andrei" },
          note: words.names,
        }),
      ],
      stop: "tool_use",
    };
  }
  const revision = Number(
    latest(request.messages, /revision"?[=:]"?(\d+)/) ?? 1,
  );
  const warm = revision % 2 === 1;
  return {
    content: [
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
    stop: "tool_use",
  };
}

/** An item's name inside a sentence: "invitație", "RSVP card". */
function itemLabel(kind: string | undefined, language: Language): string {
  const label = Object.hasOwn(productKindLabels, kind ?? "")
    ? productKindLabels[kind as ProductKind][language]
    : language === "en"
      ? "item"
      : "piesă";
  return /^.[a-zăâîșț]/.test(label)
    ? label.charAt(0).toLowerCase() + label.slice(1)
    : label;
}

const romanian = {
  looking: "Mă uit la design așa cum îl vedeți.",
  choosing: "Aleg o paletă nouă pentru accent și ilustrații.",
  warmer: "Culori mai calde",
  cooler: "Culori mai reci",
  done: "Gata: am schimbat paleta, iar accentul și ilustrațiile au acum un ton nou. Dacă nu vă place, apăsați „Anulați”.",
  naming: "Scriu niște nume de probă în detalii.",
  names: "Nume de probă",
  named:
    "Gata: am scris niște nume de probă în detalii, iar toate piesele le arată. Dacă nu vă plac, apăsați „Anulați”.",
  composing: (item: string) =>
    `Scriu textul pentru ${item} în tonul ales și îi fac loc.`,
  wording: "Textul în tonul ales",
  composed: (item: string) =>
    `Gata: am scris textul pentru ${item} în tonul ales, cu detaliile dumneavoastră, și i-am făcut puțin mai mult loc. Dacă nu vă place, apăsați „Anulați”.`,
};

const english = {
  looking: "Looking at the design as you see it.",
  choosing: "Choosing a new palette for the accent and the artwork.",
  warmer: "Warmer colours",
  cooler: "Cooler colours",
  done: "Done: I've changed the palette, so the accent and the artwork have a new tone. If you don't like it, press Undo.",
  naming: "Writing sample names into your details.",
  names: "Sample names",
  named:
    "Done: I've written sample names into your details, and every piece shows them. If you don't like them, press Undo.",
  composing: (item: string) =>
    `Writing the words for the ${item} in the tone you chose, and making room for them.`,
  wording: "Wording in the tone you chose",
  composed: (item: string) =>
    `Done: I've written the words for the ${item} in the tone you chose, with your details, and given them a little more room. If you don't like it, press Undo.`,
};

type Lines = Record<Language, string>;

/**
 * The stand-in's wording for each tone, with the couple's details as tokens:
 * an opening for the item written first, a closing for the items after it.
 */
const wordings: Record<
  "wedding" | "christening",
  Record<string, { opening: Lines; closing: Lines }>
> = {
  wedding: {
    classic: {
      opening: {
        ro: "Cu binecuvântarea părinților,\n{{partner1}} și {{partner2}} vă invită la cununia lor",
        en: "Together with their parents,\n{{partner1}} and {{partner2}} invite you to their wedding",
      },
      closing: {
        ro: "Vă mulțumim că ne sunteți alături,\n{{partner1}} și {{partner2}}",
        en: "Thank you for being with us,\n{{partner1}} and {{partner2}}",
      },
    },
    romantic: {
      opening: {
        ro: "O privire a început o poveste:\n{{partner1}} și {{partner2}} vă invită să o sărbătoriți",
        en: "One glance began a story:\n{{partner1}} and {{partner2}} invite you to celebrate it",
      },
      closing: {
        ro: "Cu toată dragostea noastră,\n{{partner1}} și {{partner2}}",
        en: "With all our love,\n{{partner1}} and {{partner2}}",
      },
    },
    modern: {
      opening: {
        ro: "Ne căsătorim!\n{{partner1}} & {{partner2}}",
        en: "We're getting married!\n{{partner1}} & {{partner2}}",
      },
      closing: {
        ro: "Ne vedem acolo!\n{{partner1}} & {{partner2}}",
        en: "See you there!\n{{partner1}} & {{partner2}}",
      },
    },
  },
  christening: {
    classic: {
      opening: {
        ro: "Cu bucurie vă invităm la Taina Sfântului Botez\na copilului nostru, {{child}}",
        en: "With joy we invite you to the holy christening\nof our child, {{child}}",
      },
      closing: {
        ro: "Vă mulțumim că ne sunteți alături,\n{{parents}}",
        en: "Thank you for being with us,\n{{parents}}",
      },
    },
    tender: {
      opening: {
        ro: "Un mic miracol a venit în viața noastră:\n{{child}} primește Sfântul Botez",
        en: "A small miracle came into our lives:\n{{child}} is being christened",
      },
      closing: {
        ro: "Cu drag,\n{{child}} și părinții",
        en: "With love,\n{{child}} and family",
      },
    },
    playful: {
      opening: {
        ro: "Vă aștept la botezul meu!\n{{child}}",
        en: "Come to my christening!\n{{child}}",
      },
      closing: {
        ro: "Vă aștept cu drag!\n{{child}}",
        en: "Can't wait to see you!\n{{child}}",
      },
    },
  },
};

interface CompactLayer {
  id: string;
  type: string;
  text?: string;
  style?: string;
  frame?: { x: number; y: number; width: number; height: number };
  locked?: boolean;
  hidden?: boolean;
}

interface CompactDesign {
  occasion?: string;
  language?: string;
  pieces?: ({ id: string } & Partial<
    Record<"front" | "back", { layers?: CompactLayer[] }>
  >)[];
}

const hundredths = (value: number) => Math.round(value * 100) / 100;

/**
 * The stand-in's change for a composition's item: the cards' language, and
 * a line in the chosen tone written into one of the item's running texts
 * (body or small), preferably one without tokens: the first of the item
 * written first, the last of the others, as a closing. Its frame grows to
 * fit and keeps its centre.
 */
function composeChange(
  messages: BetaMessageParam[],
  context: string,
  first: boolean,
): { revision: number; operations: unknown[] } | undefined {
  const revision = Number(/<design revision="(\d+)"/.exec(context)?.[1]);
  const json = latest(
    messages,
    /<design revision="\d+" language="\w+">\n(.*)\n<\/design>/,
  );
  if (!json || !Number.isInteger(revision)) return undefined;
  let design: CompactDesign;
  try {
    design = JSON.parse(json) as CompactDesign;
  } catch {
    return undefined;
  }
  const chosen = /<wording language="(\w+)"/.exec(context)?.[1];
  const language: Language = (chosen ?? design.language) === "en" ? "en" : "ro";
  const tone = /<wording language="\w+" tone="(\w+)"/.exec(context)?.[1];
  const own = /as they wrote it: ("(?:[^"\\]|\\.)*")\./.exec(context)?.[1];
  const occasion =
    design.occasion === "christening" ? "christening" : "wedding";
  const tones = wordings[occasion];
  const wording = (tones[tone ?? ""] ?? tones.classic)?.[
    first ? "opening" : "closing"
  ][language];
  const candidates = (design.pieces ?? []).flatMap((piece) =>
    (["front", "back"] as const).flatMap((face) =>
      (piece[face]?.layers ?? []).flatMap((layer) =>
        layer.type === "text" &&
        typeof layer.text === "string" &&
        layer.frame &&
        !layer.locked &&
        !layer.hidden
          ? [{ piece: piece.id, face, layer, frame: layer.frame }]
          : [],
      ),
    ),
  );
  const running = candidates.filter(
    ({ layer }) => layer.style === "body" || layer.style === "small",
  );
  const pick = (list: typeof candidates) => (first ? list[0] : list.at(-1));
  const target =
    pick(running.filter(({ layer }) => !layer.text?.includes("{{"))) ??
    pick(running) ??
    pick(candidates);
  if (!wording || !target) return undefined;
  const written =
    first && own ? `${JSON.parse(own) as string}\n${wording}` : wording;
  const lines = (value: string) => value.split("\n").length;
  const { frame } = target;
  const height = hundredths(
    (frame.height / lines(target.layer.text ?? "")) * lines(written) * 1.1,
  );
  const y = hundredths(Math.max(0, frame.y + (frame.height - height) / 2));
  return {
    revision,
    operations: [
      ...(language !== design.language
        ? [{ op: "setLanguage", language }]
        : []),
      {
        op: "updateLayer",
        piece: target.piece,
        face: target.face,
        layer: target.layer.id,
        set: { text: written, frame: { y, height } },
      },
    ],
  };
}

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

/** The context block of the reply being written: the newest one. */
function latestContext(messages: BetaMessageParam[]): string {
  return (
    texts(messages)
      .reverse()
      .find((value) => value.startsWith("<context>")) ?? ""
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
