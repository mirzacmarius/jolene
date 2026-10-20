import { describe, expect, test } from "bun:test";
import {
  type DesignDocument,
  eucaliptInvitation,
  parseDocument,
} from "@jolene/design";
import { changedParts, joinChange } from "./changes";

const invitation = parseDocument(eucaliptInvitation);

/** The invitation with a change made to a copy of it. */
function changed(change: (document: DesignDocument) => void) {
  const copy = structuredClone(invitation);
  change(copy);
  return copy;
}

const front = (document: DesignDocument) => {
  const card = document.pieces.find((piece) => piece.id === "card");
  if (!card) throw new Error("No card");
  return card.front;
};

describe("the parts a change touched", () => {
  test("are none for the same design, whatever order its keys are in", () => {
    const reordered = parseDocument(
      JSON.parse(
        JSON.stringify(invitation, (_, value) =>
          value && typeof value === "object" && !Array.isArray(value)
            ? Object.fromEntries(Object.entries(value).reverse())
            : value,
        ),
      ),
    );
    expect(changedParts(invitation, reordered)).toEqual(new Set());
  });

  test("name each colour, text style and setting on its own", () => {
    const after = changed((document) => {
      document.theme.palette.accent = "#4f6b5d";
      document.theme.text.names.size = 30;
      const card = document.pieces[0];
      if (card) card.stock = "textured-300";
      const names = front(document).layers.find(
        (layer) => layer.id === "names",
      );
      if (names) names.frame.y += 4;
    });
    expect(changedParts(invitation, after)).toEqual(
      new Set([
        "theme palette accent",
        "theme text names",
        "piece card stock",
        "layer card front names frame",
      ]),
    );
  });

  test("count layers swapping places as the face's order, not one added", () => {
    const swapped = changed((document) => {
      const layers = front(document).layers;
      const [first, second] = layers.splice(1, 2);
      if (first && second) layers.splice(1, 0, second, first);
    });
    expect(changedParts(invitation, swapped)).toEqual(
      new Set(["face card front order"]),
    );

    const added = changed((document) => {
      const names = front(document).layers.find(
        (layer) => layer.id === "names",
      );
      if (names) front(document).layers.push({ ...names, id: "monogram" });
    });
    const parts = [...changedParts(invitation, added)];
    expect(parts.length).toBeGreaterThan(0);
    for (const part of parts)
      expect(part).toStartWith("layer card front monogram ");
  });
});

describe("joining a change to the one it reworks", () => {
  test("takes in every design change between them, in order", () => {
    const changes = [
      { kind: "design" as const, revision: 2, note: "Verde mai blând" },
      {
        kind: "details" as const,
        previous: { godparents: "" },
        note: "Nașii",
      },
      { kind: "design" as const, revision: 3, note: "Ilustrații mai reci" },
    ];
    expect(
      joinChange(changes, 0, {
        kind: "design",
        revision: 4,
        note: "Verdele de la început",
      }),
    ).toEqual([
      {
        kind: "design",
        revision: 2,
        note: "Verde mai blând · Ilustrații mai reci · Verdele de la început",
      },
      { kind: "details", previous: { godparents: "" }, note: "Nașii" },
      {
        kind: "design",
        revision: 3,
        note: "Ilustrații mai reci",
        joined: true,
      },
      {
        kind: "design",
        revision: 4,
        note: "Verdele de la început",
        joined: true,
      },
    ]);
  });
});
