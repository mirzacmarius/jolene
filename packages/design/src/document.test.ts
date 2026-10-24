import { describe, expect, test } from "bun:test";
import { fieldKeysShown, fieldKeysUsed, withoutHiddenLayers } from "./fields";
import { applyOperations } from "./ops";
import {
  eucaliptFields,
  eucaliptInvitation,
  eucaliptMenu,
  eucaliptPlaceCard,
  eucaliptSaveTheDate,
} from "./samples";
import { documentSchema, parseDocument } from "./schema";

const invitation = parseDocument(eucaliptInvitation);

describe("documentSchema", () => {
  test("accepts every sample and fills in defaults", () => {
    for (const sample of [
      eucaliptInvitation,
      eucaliptSaveTheDate,
      eucaliptPlaceCard,
      eucaliptMenu,
    ]) {
      expect(documentSchema.safeParse(sample).success).toBe(true);
    }
    const card = invitation.pieces[0];
    expect(card?.bleed).toBe(3);
    expect(card?.front.layers.find((l) => l.id === "names")?.ink).toBe(
      "foil-gold",
    );
  });

  test("rejects a repeated id", () => {
    const copy = structuredClone(invitation);
    const layers = copy.pieces[0]?.front.layers ?? [];
    layers.push({ ...(layers[0] as (typeof layers)[number]) });
    const result = documentSchema.safeParse(copy);
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toContain('Duplicate id "border"');
  });

  test("a seal's wax is one of the catalog's, or a colour of its own", () => {
    const withWax = (color: string) => ({
      ...eucaliptInvitation,
      accessories: [{ ...invitation.accessories[0], color }],
    });
    expect(parseDocument(withWax("gold")).accessories[0]).toMatchObject({
      color: "gold",
    });
    expect(parseDocument(withWax("#8A5A2B")).accessories[0]).toMatchObject({
      color: "#8a5a2b",
    });
    expect(documentSchema.safeParse(withWax("bronze")).success).toBe(false);
  });

  test("rejects colours that are neither hex nor a palette token", () => {
    const copy = structuredClone(invitation) as unknown as {
      theme: { text: { body: { color: string } } };
    };
    copy.theme.text.body.color = "$gold";
    expect(documentSchema.safeParse(copy).success).toBe(false);
  });

  test("keeps text style overrides sparse", () => {
    const parents = invitation.pieces[0]?.front.layers.find(
      (layer) => layer.id === "parents",
    );
    expect(parents?.type === "text" && parents.overrides).toEqual({
      italic: true,
      size: 10,
    });
  });

  test("offers only fonts that set Romanian", () => {
    const copy = structuredClone(invitation) as unknown as {
      theme: { text: { names: { font: string } } };
    };
    copy.theme.text.names.font = "Parisienne";
    expect(documentSchema.safeParse(copy).success).toBe(false);
  });
});

describe("applyOperations", () => {
  test("moves, restyles and recolours in one batch", () => {
    const result = applyOperations(invitation, [
      {
        op: "updateLayer",
        piece: "card",
        face: "front",
        layer: "names",
        set: { frame: { y: 49 }, overrides: { size: 38 } },
      },
      { op: "setPalette", palette: { accent: "#7a4b5c" } },
      { op: "setTextStyle", style: "body", set: { font: "EB Garamond" } },
    ]);
    if (!result.ok) throw new Error(result.error);
    const names = result.document.pieces[0]?.front.layers.find(
      (l) => l.id === "names",
    );
    expect(names?.frame).toEqual({ x: 10, y: 49, width: 100, height: 18 });
    expect(names?.type === "text" && names.overrides.size).toBe(38);
    expect(result.document.theme.palette.accent).toBe("#7a4b5c");
    expect(result.document.theme.text.body.font).toBe("EB Garamond");
    // The original is untouched.
    expect(invitation.theme.palette.accent).toBe("#56664a");
  });

  test("adds, reorders and removes layers", () => {
    const result = applyOperations(invitation, [
      {
        op: "addLayer",
        piece: "card",
        face: "front",
        index: 0,
        layer: {
          id: "wash",
          type: "shape",
          shape: "rect",
          frame: { x: 0, y: 0, width: 120, height: 170 },
          fill: "$paper",
        },
      },
      {
        op: "moveLayer",
        piece: "card",
        face: "front",
        layer: "wash",
        index: 2,
      },
      { op: "removeLayer", piece: "card", face: "front", layer: "rsvp" },
    ]);
    if (!result.ok) throw new Error(result.error);
    const ids = result.document.pieces[0]?.front.layers.map((l) => l.id);
    expect(ids?.slice(0, 3)).toEqual(["border", "sprig", "wash"]);
    expect(ids).not.toContain("rsvp");
  });

  test("changes nothing when one operation fails", () => {
    const result = applyOperations(invitation, [
      { op: "setPalette", palette: { accent: "#000000" } },
      {
        op: "updateLayer",
        piece: "card",
        face: "front",
        layer: "sprig",
        set: { text: "hello" },
      },
    ]);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("Operation 2");
      expect(result.error).toContain("image layer, which has no text");
    }
    expect(invitation.theme.palette.accent).toBe("#56664a");
  });

  test("reports a layer that does not exist", () => {
    const result = applyOperations(invitation, [
      { op: "removeLayer", piece: "card", face: "front", layer: "nope" },
    ]);
    expect(result).toEqual({
      ok: false,
      error: 'Operation 1: No layer "nope"',
    });
  });

  test("validates the document the operations produce", () => {
    const result = applyOperations(invitation, [
      {
        op: "updateLayer",
        piece: "card",
        face: "front",
        layer: "names",
        set: { opacity: 3 },
      },
    ]);
    expect(result.ok).toBe(false);
  });

  test("takes a tint off with null", () => {
    const result = applyOperations(invitation, [
      {
        op: "updateLayer",
        piece: "card",
        face: "front",
        layer: "sprig",
        set: { tint: null },
      },
    ]);
    if (!result.ok) throw new Error(result.error);
    const sprig = result.document.pieces[0]?.front.layers.find(
      (l) => l.id === "sprig",
    );
    expect(sprig && "tint" in sprig).toBe(false);
  });

  test("fits a picture to its frame, and words only their own way", () => {
    const refit = (layer: string, value: "cover" | "shrink") =>
      applyOperations(invitation, [
        {
          op: "updateLayer",
          piece: "card",
          face: "front",
          layer,
          set: { fit: value },
        },
      ]);
    const covered = refit("sprig", "cover");
    if (!covered.ok) throw new Error(covered.error);
    const sprig = covered.document.pieces[0]?.front.layers.find(
      (l) => l.id === "sprig",
    );
    expect(sprig?.type === "image" && sprig.fit).toBe("cover");
    expect(refit("names", "cover").ok).toBe(false);
    expect(refit("sprig", "shrink").ok).toBe(false);
  });

  test("sets a face background through updatePiece", () => {
    const result = applyOperations(invitation, [
      { op: "updatePiece", piece: "card", set: { background: "#fdf6ee" } },
    ]);
    if (!result.ok) throw new Error(result.error);
    expect(result.document.pieces[0]?.front.background).toBe("#fdf6ee");
  });
});

test("sample fields fill every token the invitation uses", () => {
  const tokens = invitation.pieces
    .flatMap((piece) => piece.front.layers)
    .flatMap((layer) =>
      layer.type === "text"
        ? [...layer.text.matchAll(/\{\{(\w+)/g)].map((m) => m[1])
        : [],
    );
  for (const token of tokens) {
    if (token === "monogram") continue;
    expect(eucaliptFields[token as string]).toBeTruthy();
  }
});

test("lists the fields a design reads, seal included, in the occasion's order", () => {
  const keys = fieldKeysUsed(invitation);
  expect(keys.slice(0, 4)).toEqual([
    "partner1",
    "partner2",
    "partner1Parents",
    "partner2Parents",
  ]);
  expect(keys).toContain("monogram");
  expect(keys).not.toContain("menu");
});

test("shows only what prints: no hidden layer, and the names behind a monogram", () => {
  const card = parseDocument(eucaliptPlaceCard);
  expect(fieldKeysShown(card)).toEqual(["guestName", "tableName"]);
  const hidden = applyOperations(card, [
    {
      op: "updateLayer",
      piece: "card",
      face: "front",
      layer: "table",
      set: { hidden: true },
    },
  ]);
  if (!hidden.ok) throw new Error(hidden.error);
  expect(fieldKeysShown(hidden.document)).toEqual(["guestName"]);
  // Every word is still there to edit; the printed document leaves it out.
  expect(fieldKeysUsed(hidden.document)).toContain("tableName");
  const printed = withoutHiddenLayers(hidden.document);
  expect(
    printed.pieces[0]?.front?.layers.map((layer) => layer.id),
  ).not.toContain("table");
  expect(hidden.document.pieces[0]?.front?.layers).toHaveLength(
    card.pieces[0]?.front?.layers.length ?? 0,
  );
  // The monogram is drawn from the names while none is typed.
  const shown = fieldKeysShown(invitation);
  expect(shown).toContain("monogram");
  expect(shown).toContain("partner1");
  expect(shown).toContain("partner2");
});

test("switches the language dates are spelled in", () => {
  const result = applyOperations(invitation, [
    { op: "setLanguage", language: "en" },
  ]);
  if (!result.ok) throw new Error(result.error);
  expect(result.document.language).toBe("en");
  expect(invitation.language).toBe("ro");
});
