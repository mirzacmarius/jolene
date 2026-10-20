import { describe, expect, test } from "bun:test";
import { eucaliptInvitation, parseDocument } from "@jolene/design";
import {
  type ContextInput,
  compactDocument,
  describeView,
  detailsKey,
  messageContext,
  recap,
  wordingOf,
} from "./context";

const invitation = parseDocument(eucaliptInvitation);

const input: ContextInput = {
  locale: "en",
  view: "card:front",
  revision: 4,
  document: invitation,
  designChanged: true,
  occasion: "wedding",
  details: { partner1: "Ana" },
  detailsChanged: true,
  used: ["partner1", "partner2"],
  collection: { name: "Eucalyptus", styles: ["botanic"] },
  undone: [],
  snapshot: true,
};

describe("the context of a message", () => {
  test("holds the design without the schema's defaults", () => {
    const compact = JSON.stringify(compactDocument(invitation));
    const layers = JSON.stringify(
      (
        compactDocument(invitation) as { pieces: { front: unknown }[] }
      ).pieces.map((piece) => piece.front),
    );
    for (const fallback of [
      '"opacity":1',
      '"rotation":0',
      '"hidden":false',
      '"locked":false',
      '"ink":"print"',
      '"overrides":{}',
    ])
      expect(layers).not.toContain(fallback);
    // What a design sets itself stays.
    expect(compact).toContain('"locked":true');
    expect(compact).toContain('"ink":"foil-gold"');
    const ids = invitation.pieces.flatMap((piece) =>
      (piece.front?.layers ?? []).map((layer) => layer.id),
    );
    for (const id of ids) expect(compact).toContain(`"id":"${id}"`);
  });

  test("names what the studio shows, the design and the details", () => {
    const context = messageContext(input);
    expect(context).toStartWith("<context>");
    expect(context).toContain(
      `<studio language="en" showing="the front of the piece 'card'" snapshot="attached below" />`,
    );
    expect(context).toContain('<design revision="4" language="ro">');
    expect(context).toContain('used-by-this-design="partner1, partner2"');
    expect(context).toContain('{"partner1":"Ana"}');
    expect(context).not.toContain("<earlier>");
    expect(context).not.toContain("<undone>");
  });

  test("says only that nothing changed, when nothing did", () => {
    const context = messageContext({
      ...input,
      designChanged: false,
      detailsChanged: false,
      undone: ["Softer greens"],
      recap: "The couple: Hello",
    });
    expect(context).toContain('<design revision="4" unchanged="true">');
    expect(context).toContain('<details unchanged="true">');
    expect(context).not.toContain('"pieces"');
    expect(context).toContain("since your last reply: Softer greens.");
    expect(context).toContain("The couple: Hello");
  });

  test("asks for the wording the couple chose, and a composition's place", () => {
    const wording = {
      tone: { id: "romantic", brief: "romantic and warm" },
      line: 'Iubirea "nu" cere nimic',
      language: "en" as const,
    };
    const first = messageContext({
      ...input,
      wording,
      composition: { items: ["Invitation", "Menu"], item: "Invitation" },
    });
    expect(first).toContain(
      '<wording language="en" tone="romantic">The couple chose how their collection\'s words should read: romantic and warm, written in English.',
    );
    expect(first).toContain(
      'as they wrote it: "Iubirea \\"nu\\" cere nimic".</wording>',
    );
    expect(first).toContain('<composition item="Invitation" first="true">');
    expect(first).toContain("in this order: Invitation, Menu.");
    expect(first).toContain("It is written first");
    expect(first.indexOf("<composition")).toBeLessThan(
      first.indexOf("</context>"),
    );

    const later = messageContext({
      ...input,
      composition: {
        items: ["Invitation", "Menu"],
        item: "Menu",
        follows: wordingOf(invitation),
      },
    });
    expect(later).not.toContain("<wording");
    expect(later).toContain('<composition item="Menu" first="false">');
    expect(later).toContain(
      '- Invitația, front, names: "{{partner1}} & {{partner2}}"',
    );
    const alone = messageContext({
      ...input,
      composition: { items: ["Invitation", "Menu"], item: "Menu" },
    });
    expect(alone).toContain("its wording wasn't finished");
  });

  test("describes the assembly and the faces", () => {
    expect(describeView(undefined)).toBe(
      "the whole item assembled, as it arrives",
    );
    expect(describeView("vellum:back")).toBe("the back of the piece 'vellum'");
  });

  test("tells details apart whatever their order", () => {
    expect(detailsKey({ a: "1", b: "2" })).toBe(detailsKey({ b: "2", a: "1" }));
    expect(detailsKey({ a: "1" })).not.toBe(detailsKey({ a: "2" }));
  });

  test("recaps the latest exchanges in a few words each", () => {
    const messages = Array.from({ length: 20 }, (_, index) => ({
      role: index % 2 === 0 ? ("couple" as const) : ("designer" as const),
      text: `${index} ${"cuvânt ".repeat(index === 19 ? 100 : 1)}`,
    }));
    const lines = recap(messages).split("\n");
    expect(lines).toHaveLength(12);
    expect(lines[0]).toBe("The couple: 8 cuvânt");
    expect(lines[11]?.startsWith("You: 19 cuvânt")).toBe(true);
    expect(lines[11]?.endsWith("…")).toBe(true);
  });
});
