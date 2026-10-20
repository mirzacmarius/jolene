import {
  type DesignDocument,
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
  snapshot: boolean;
}

/** The context block that opens each of the couple's messages. */
export function messageContext(input: ContextInput): string {
  const lines = [
    "<context>",
    `<studio language="${input.locale}" showing="${describeView(input.view)}"${input.snapshot ? ' snapshot="attached below"' : ""} />`,
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
