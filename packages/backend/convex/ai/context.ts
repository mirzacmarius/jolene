import {
  type DesignDocument,
  faceNames,
  type Language,
  type Occasion,
  productKindLabels,
  suiteStyleLabel,
} from "@jolene/design";

/**
 * What the AI designer is told with each of the couple's messages: the
 * design, the couple's details, the collection, and what the studio shows.
 * Written once, when the message is sent, and replayed verbatim after.
 */

/** Paths longer than this are shortened in the document the model reads. */
const LONG_PATH = 300;

/** Values the design schema fills in when a document leaves them out. */
const layerDefaults: Record<string, unknown> = {
  rotation: 0,
  opacity: 1,
  hidden: false,
  locked: false,
  ink: "print",
  replaceable: false,
  flipX: false,
  flipY: false,
  fill: null,
  stroke: null,
  radius: 0,
};
const textDefaults: Record<string, unknown> = {
  align: "center",
  valign: "middle",
  fit: "shrink",
};

const isEmpty = (value: unknown) =>
  value !== null &&
  typeof value === "object" &&
  Object.keys(value as object).length === 0;

function shortenPath(path: string): string {
  return path.length > LONG_PATH
    ? `${path.slice(0, 60)}… (shortened from ${path.length} characters)`
    : path;
}

/** Rounds away floating-point noise: a hundredth of a millimetre is plenty. */
function round(value: unknown): unknown {
  if (typeof value === "number") return Math.round(value * 100) / 100;
  if (Array.isArray(value)) return value.map(round);
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value).map(([key, inner]) => [key, round(inner)]),
    );
  return value;
}

/**
 * The document as the model reads it: the same JSON without the values that
 * equal the schema's defaults, numbers rounded and long SVG paths shortened.
 * It is a view for the prompt only; the design itself is never stored so.
 */
export function compactDocument(document: DesignDocument): unknown {
  const pieces = document.pieces.map((piece) => {
    const faces = Object.fromEntries(
      (["front", "back"] as const).flatMap((name) => {
        const face = piece[name];
        if (!face) return [];
        const layers = face.layers.map((layer) => {
          const entries = Object.entries(layer).filter(([key, value]) => {
            if (layerDefaults[key] === value) return false;
            if (layer.type === "text" && textDefaults[key] === value)
              return false;
            if (layer.type === "image" && key === "fit" && value === "contain")
              return false;
            if (key === "overrides" && isEmpty(value)) return false;
            return true;
          });
          const compact = Object.fromEntries(entries);
          if (typeof compact.path === "string")
            compact.path = shortenPath(compact.path);
          return compact;
        });
        return [
          [
            name,
            face.background === null
              ? { layers }
              : { background: face.background, layers },
          ],
        ];
      }),
    );
    const {
      front: _front,
      back: _back,
      fold,
      paper,
      shape,
      place,
      ...rest
    } = piece;
    const plainShape = shape.kind === "rect" && shape.radius === 0;
    const inPlace = place.x === 0 && place.y === 0 && place.rotation === 0;
    return {
      ...rest,
      ...(fold === null ? {} : { fold }),
      ...(paper === null ? {} : { paper }),
      ...(plainShape
        ? {}
        : {
            shape:
              shape.kind === "die"
                ? { kind: "die", path: shortenPath(shape.path) }
                : shape,
          }),
      ...(inPlace ? {} : { place }),
      ...faces,
    };
  });
  const { accessories, envelope, ...rest } = document;
  return round({
    ...rest,
    pieces,
    ...(accessories.length > 0 ? { accessories } : {}),
    ...(envelope ? { envelope } : {}),
  });
}

/** What the studio shows, in the model's words. */
export function describeView(view: string | undefined): string {
  if (!view || view === "assembly")
    return "the whole item assembled, as it arrives";
  const [piece, face] = view.split(":");
  return `the ${face === "back" ? "back" : "front"} of the piece '${piece}'`;
}

/**
 * The couple's details as one string, whatever order their keys come in:
 * what the AI designer last knew of them, to tell whether they changed.
 */
export function detailsKey(fields: Record<string, string>): string {
  return JSON.stringify(
    Object.entries(fields).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)),
  );
}

export interface ContextInput {
  locale: Language;
  view?: string;
  revision: number;
  document: DesignDocument;
  /** False when the design is as the AI designer last knew it. */
  designChanged: boolean;
  occasion: Occasion;
  details: Record<string, string>;
  detailsChanged: boolean;
  /** The details the design's words read. */
  used: string[];
  collection: { name: string; styles: string[] };
  /** Changes of the AI designer's that the couple has undone since. */
  undone: string[];
  /** The conversation so far, for a thread that starts afresh. */
  recap?: string;
  /**
   * The studio's drawing of what it shows: attached to the message, or left
   * out as the same as the model last saw. None when the studio sent none.
   */
  snapshot?: "attached" | "seen";
  /** How the couple wants their collection's wording, when they've said. */
  wording?: WordingContext;
  /** The item's place in a composition, when simple mode asked for it. */
  composition?: CompositionContext;
}

export interface WordingContext {
  /** The tone's id and what it asks of the words (simple/tones.ts). */
  tone?: { id: string; brief: string };
  /** A line of the couple's own: a verse, a quote, something about them. */
  line?: string;
  /** The language they chose for their cards. */
  language: Language;
}

export interface CompositionContext {
  /** The items written together, first item first, by their English names. */
  items: string[];
  /** This message's item. */
  item: string;
  /**
   * For the items after the first: the first item's wording, once the AI
   * designer has written it (a first item that failed leaves none).
   */
  follows?: string;
}

const languageNames: Record<Language, string> = {
  ro: "Romanian",
  en: "English",
};

/** Wording this long is cut, so a crowded item can't fill the context. */
const MAX_WORDING = 4000;

/**
 * A design's words as the AI designer reads them, face by face: each text
 * layer with its tokens, for the items that follow it.
 */
export function wordingOf(document: DesignDocument): string {
  const lines: string[] = [];
  for (const piece of document.pieces)
    for (const face of faceNames)
      for (const layer of piece[face]?.layers ?? [])
        if (layer.type === "text" && !layer.hidden && layer.text.trim())
          lines.push(
            `- ${piece.name ?? piece.id}, ${face}, ${layer.style}: ${JSON.stringify(layer.text)}`,
          );
  const wording = lines.join("\n");
  return wording.length > MAX_WORDING
    ? `${wording.slice(0, MAX_WORDING)}…`
    : wording;
}

function wordingSection(wording: WordingContext): string[] {
  const attributes = `language="${wording.language}"${wording.tone ? ` tone="${wording.tone.id}"` : ""}`;
  const sentences = [
    "The couple chose how their collection's words should read:",
    wording.tone
      ? `${wording.tone.brief}, written in ${languageNames[wording.language]}.`
      : `written in ${languageNames[wording.language]}, in the tone that suits the collection.`,
    "Follow it whenever you write words for one of their items, unless they ask otherwise.",
  ];
  if (wording.tone)
    sentences.push(
      "The tone decides whose voice the words speak in and how they sound: a template's words show only what an item says, so write them anew in this tone rather than keeping their voice.",
    );
  if (wording.line)
    sentences.push(
      `Their own line, to use where it fits best (usually the invitation's opening) and as they wrote it: ${JSON.stringify(wording.line)}.`,
    );
  return [`<wording ${attributes}>${sentences.join(" ")}</wording>`];
}

function compositionSection(composition: CompositionContext): string[] {
  const [lead] = composition.items;
  const first = composition.item === lead;
  const lines = [
    `<composition item="${composition.item}" first="${first}">`,
    `The couple answered simple mode's questions and asked you to write the wording of these items of their collection and lay each one out, each in its own conversation, in this order: ${composition.items.join(", ")}. This message is about the ${composition.item}.`,
    "Write its words in the language the couple chose for their cards (setLanguage first when the design is in another), keep their details as tokens, and arrange the faces so everything fits with calm space, as Jolene's taste asks. Every detail they have given that this kind of item carries goes on it, even where the template has no line for it: an invitation names the parents and the godparents, and gives each ceremony, the party and the reply line. Then say in a sentence or two what you wrote.",
  ];
  if (first)
    lines.push(
      composition.items.length > 1
        ? "It is written first: the other items will follow its wording, so it sets the collection's voice."
        : "It is the only item the couple asked for.",
    );
  else if (composition.follows)
    lines.push(
      `The ${lead} was written first. Its wording, which this item should echo (the same voice and the same turns of phrase where they fit) so the collection speaks with one voice:`,
      composition.follows,
    );
  else
    lines.push(
      `The ${lead} was to be written first, but its wording wasn't finished: write this item in the chosen tone on its own.`,
    );
  lines.push("</composition>");
  return lines;
}

const snapshotNotes = {
  attached: ' snapshot="attached below"',
  seen: ' snapshot="as you last saw it"',
  none: "",
};

/** The context block that opens each of the couple's messages. */
export function messageContext(input: ContextInput): string {
  const lines = [
    "<context>",
    `<studio language="${input.locale}" showing="${describeView(input.view)}"${snapshotNotes[input.snapshot ?? "none"]} />`,
    `<item kind="${input.document.kind}" name="${productKindLabels[input.document.kind].en}" collection="${input.collection.name}" styles="${input.collection.styles.map((style) => suiteStyleLabel(style, "en")).join(", ")}" />`,
  ];
  if (input.recap)
    lines.push(
      "<earlier>",
      "This conversation began earlier; you no longer have its details. What was said, in short:",
      input.recap,
      "</earlier>",
    );
  if (input.undone.length > 0)
    lines.push(
      `<undone>The couple undid these changes of yours since your last reply: ${input.undone.join("; ")}.</undone>`,
    );
  if (input.designChanged)
    lines.push(
      `<design revision="${input.revision}" language="${input.document.language}">`,
      JSON.stringify(compactDocument(input.document)),
      "</design>",
    );
  else
    lines.push(
      `<design revision="${input.revision}" unchanged="true">The design is as you last knew it.</design>`,
    );
  if (input.detailsChanged)
    lines.push(
      `<details occasion="${input.occasion}" used-by-this-design="${input.used.join(", ")}">`,
      JSON.stringify(input.details),
      "</details>",
    );
  else
    lines.push(
      `<details unchanged="true">The couple's details are as you last knew them.</details>`,
    );
  if (input.wording) lines.push(...wordingSection(input.wording));
  if (input.composition) lines.push(...compositionSection(input.composition));
  lines.push("</context>");
  return lines.join("\n");
}

/** A few words of a long text, for a recap. */
function excerpt(text: string, length: number): string {
  const flat = text.replace(/\s+/g, " ").trim();
  return flat.length > length ? `${flat.slice(0, length)}…` : flat;
}

/** The latest exchanges, for a thread that starts afresh. */
export function recap(
  messages: { role: "couple" | "designer"; text: string }[],
): string {
  return messages
    .filter((message) => message.text.trim())
    .slice(-12)
    .map(
      (message) =>
        `${message.role === "couple" ? "The couple" : "You"}: ${excerpt(message.text, 400)}`,
    )
    .join("\n");
}
