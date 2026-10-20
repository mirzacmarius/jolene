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
 * item's texts or a new one, lays it out, and says so. Enough to try the
 * whole flow in the browser.
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
    if (!change) return { content: [text(words.kept(item))], stop: "end_turn" };
    return {
      content: [
        note(words.composing(item)),
        toolUse(toolNames.applyOperations, { ...change, note: words.wording }),
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
    `Gata: am scris textul pentru ${item} în tonul ales, cu detaliile voastre, și l-am așezat în pagină. Dacă nu vă place, apăsați „Anulați”.`,
  kept: (item: string) =>
    `Pe ${item} n-am găsit loc pentru încă un rând, așa că i-am lăsat textul cum era. Spuneți-mi dacă vreți să-l schimb.`,
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
    `Done: I've written the words for the ${item} in the tone you chose, with your details, and laid them out on the page. If you don't like it, press Undo.`,
  kept: (item: string) =>
    `I couldn't find room for another line on the ${item}, so I've left its wording as it was. Tell me if you'd like it changed.`,
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

interface CompactPiece
  extends Partial<Record<"front" | "back", { layers?: CompactLayer[] }>> {
  id: string;
  width?: number;
  height?: number;
  fold?: { orientation: "vertical" | "horizontal"; at: number };
}

interface CompactDesign {
  occasion?: string;
  language?: string;
  pieces?: CompactPiece[];
}

type Frame = NonNullable<CompactLayer["frame"]>;

const hundredths = (value: number) => Math.round(value * 100) / 100;

/** The room left clear along a panel's edge, in millimetres. */
const edge = (size: number) => Math.max(4, size * 0.06);

/** The height one line of small text takes, in millimetres, roughly. */
const SMALL_LINE = 4.6;

const lineCount = (value: string) => value.split("\n").length;

/** The panels a piece folds into, or the piece itself. */
function panels(width: number, height: number, fold: CompactPiece["fold"]) {
  if (fold?.orientation === "vertical")
    return [
      { x: 0, y: 0, width: fold.at, height },
      { x: fold.at, y: 0, width: width - fold.at, height },
    ];
  if (fold?.orientation === "horizontal")
    return [
      { x: 0, y: 0, width, height: fold.at },
      { x: 0, y: fold.at, width, height: height - fold.at },
    ];
  return [{ x: 0, y: 0, width, height }];
}

/**
 * The stand-in's change for a composition's item: the cards' language, and
 * a line in the chosen tone, with the couple's details as tokens. The item
 * written first has its opening in place of its first short running text
 * (body or small, a few lines without tokens), its frame grown to fit and
 * kept on the piece, or as a new small text when it has none; the others
 * have their closing as a new small text, in the widest free band below
 * the words of a panel. Texts with tokens hold the couple's details or a
 * guest's name, long ones a menu or a programme, and the others' texts
 * their own content (a guest list, the RSVP's answers): they stay as they
 * are. No room, no change.
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
  if (!wording) return undefined;
  const written =
    first && own ? `${JSON.parse(own) as string}\n${wording}` : wording;
  const toLanguage =
    language === design.language ? [] : [{ op: "setLanguage", language }];
  const faces = (design.pieces ?? []).flatMap((piece) =>
    (["front", "back"] as const).flatMap((face) => {
      const layers = piece[face]?.layers;
      return layers ? [{ piece, face, layers }] : [];
    }),
  );
  const texts = faces.flatMap(({ piece, face, layers }) =>
    layers.flatMap((layer) =>
      layer.type === "text" &&
      typeof layer.text === "string" &&
      layer.frame &&
      !layer.hidden
        ? [{ piece, face, layer, text: layer.text, frame: layer.frame }]
        : [],
    ),
  );
  const short = texts.filter(
    ({ layer, text }) =>
      !layer.locked &&
      (layer.style === "body" || layer.style === "small") &&
      !text.includes("{{") &&
      lineCount(text) <= 4 &&
      text.length <= 200,
  );

  const rewrite = (target: (typeof short)[number]) => {
    const { piece, frame } = target;
    const grown =
      (frame.height / lineCount(target.text)) * lineCount(written) * 1.1;
    const top = piece.height ? edge(piece.height) : 0;
    const bottom = piece.height ? piece.height - top : Number.POSITIVE_INFINITY;
    const height = hundredths(Math.min(grown, bottom - top));
    const centred = frame.y + (frame.height - height) / 2;
    const y = hundredths(Math.max(top, Math.min(centred, bottom - height)));
    return {
      revision,
      operations: [
        ...toLanguage,
        {
          op: "updateLayer",
          piece: target.piece.id,
          face: target.face,
          layer: target.layer.id,
          set: { text: written, frame: { y, height } },
        },
      ],
    };
  };

  // The free bands above and below the words of each panel: an opening
  // goes in the widest one above them if it fits, a closing below.
  const needed = lineCount(written) * SMALL_LINE + 1;
  const bands: {
    face: (typeof faces)[number];
    frame: Frame;
    room: number;
    above: boolean;
  }[] = [];
  for (const face of faces) {
    const { width, height, fold } = face.piece;
    if (!width || !height) continue;
    const frames = texts
      .filter((text) => text.piece === face.piece && text.face === face.face)
      .map(({ frame }) => frame);
    for (const panel of panels(width, height, fold)) {
      const inside = frames.filter((frame) => {
        const x = frame.x + frame.width / 2;
        const y = frame.y + frame.height / 2;
        return (
          x >= panel.x &&
          x < panel.x + panel.width &&
          y >= panel.y &&
          y < panel.y + panel.height
        );
      });
      if (inside.length === 0) continue;
      const top = panel.y + edge(panel.height);
      const bottom = panel.y + panel.height - edge(panel.height);
      const highest = Math.min(...inside.map((frame) => frame.y));
      const lowest = Math.max(...inside.map((frame) => frame.y + frame.height));
      const side = edge(panel.width);
      for (const [from, to, above] of [
        [Math.max(top, lowest), bottom, false],
        [top, Math.min(bottom, highest), true],
      ] as const) {
        const room = to - from;
        if (room >= needed)
          bands.push({
            face,
            room,
            above,
            frame: {
              x: hundredths(panel.x + side),
              y: hundredths(from + (room - needed) / 2),
              width: hundredths(panel.width - 2 * side),
              height: hundredths(needed),
            },
          });
      }
    }
  }
  const widest = (list: typeof bands) =>
    list.reduce<(typeof bands)[number] | undefined>(
      (wide, band) => (wide && wide.room >= band.room ? wide : band),
      undefined,
    );
  const best =
    widest(bands.filter((band) => band.above === first)) ?? widest(bands);
  const add = ({ face, frame }: (typeof bands)[number]) => {
    const ids = new Set(face.layers.map((layer) => layer.id));
    const base = first ? "opening" : "closing";
    let id = base;
    for (let count = 2; ids.has(id); count++) id = `${base}-${count}`;
    const name = first
      ? { ro: "Rândul de început", en: "Opening line" }
      : { ro: "Rândul de încheiere", en: "Closing line" };
    return {
      revision,
      operations: [
        ...toLanguage,
        {
          op: "addLayer",
          piece: face.piece.id,
          face: face.face,
          layer: {
            id,
            name: name[language],
            type: "text",
            style: "small",
            text: written,
            frame,
          },
        },
      ],
    };
  };

  if (first) {
    const target = short[0];
    if (target) return rewrite(target);
  }
  return best ? add(best) : undefined;
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
