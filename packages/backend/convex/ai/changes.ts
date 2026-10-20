import type { DesignDocument } from "@jolene/design";
import type { Infer } from "convex/values";
import type { aiChangeValidator } from "./validators";

/**
 * Telling a reply's changes apart: which parts of the design each touched
 * (each palette colour and text style, each setting of a piece, a face and
 * a layer, the order of a face's layers), and joining a change to the
 * earlier one it reworks. Pure, so it can be tested on its own.
 */

type Change = Infer<typeof aiChangeValidator>;
type DesignChange = Extract<Change, { kind: "design" }>;

/** A value as JSON with its keys sorted, so equal values read the same. */
function stable(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  if (value && typeof value === "object")
    return `{${Object.entries(value)
      .filter(([, inner]) => inner !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([key, inner]) => `${JSON.stringify(key)}:${stable(inner)}`)
      .join(",")}}`;
  return JSON.stringify(value) ?? "null";
}

/** Each setting of an object by name, with its value. */
function settings(found: Map<string, string>, name: string, value: object) {
  for (const [key, inner] of Object.entries(value))
    found.set(`${name} ${key}`, stable(inner));
}

/**
 * Each part of the design by name, with its value, and the order of each
 * face's layers.
 */
function parts(document: DesignDocument) {
  const found = new Map<string, string>();
  const orders = new Map<string, string[]>();
  const { pieces, theme, ...rest } = document;
  settings(found, "document", rest);
  for (const [key, group] of Object.entries(theme))
    settings(found, `theme ${key}`, group);
  for (const piece of pieces) {
    const { front, back, ...own } = piece;
    settings(found, `piece ${piece.id}`, own);
    for (const [name, face] of [
      ["front", front],
      ["back", back],
    ] as const) {
      if (!face) continue;
      const { layers, ...faceOwn } = face;
      settings(found, `face ${piece.id} ${name}`, faceOwn);
      orders.set(
        `face ${piece.id} ${name}`,
        layers.map((layer) => layer.id),
      );
      for (const layer of layers)
        settings(found, `layer ${piece.id} ${name} ${layer.id}`, layer);
    }
  }
  return { found, orders };
}

/**
 * The parts that differ between two versions of a design. A face's order
 * counts as changed when the layers it had and still has swap places; a
 * layer added or taken away is a change of that layer, not of the order.
 */
export function changedParts(
  before: DesignDocument,
  after: DesignDocument,
): Set<string> {
  const was = parts(before);
  const is = parts(after);
  const changed = new Set(
    [...new Set([...was.found.keys(), ...is.found.keys()])].filter(
      (name) => was.found.get(name) !== is.found.get(name),
    ),
  );
  for (const [face, order] of was.orders) {
    const now = is.orders.get(face);
    if (!now) continue;
    const kept = order.filter((id) => now.includes(id));
    if (kept.join() !== now.filter((id) => order.includes(id)).join())
      changed.add(`${face} order`);
  }
  return changed;
}

/**
 * Joins a change to the reply's earlier change at `head`, which it reworks,
 * with every design change between them: undoing that change takes them all
 * back, and its note tells them in order. The joined ones keep their places
 * in the list, so the places the studio knows the others by hold.
 */
export function joinChange(
  changes: Change[],
  head: number,
  change: DesignChange,
): Change[] {
  const first = changes[head];
  if (first?.kind !== "design") return [...changes, change];
  const notes = [first.note];
  const joined = changes.map((each, index) => {
    if (index <= head || each.kind !== "design" || each.joined) return each;
    notes.push(each.note);
    return { ...each, joined: true };
  });
  notes.push(change.note);
  joined[head] = { ...first, note: notes.join(" · ") };
  return [...joined, { ...change, joined: true }];
}
