import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { assemblyBounds } from "../geometry";
import { applyOperations } from "../ops";
import { eucaliptFields, eucaliptInvitation } from "../samples";
import { type DesignDocument, parseDocument } from "../schema";
import { envelopeBox, envelopeLayout } from "./envelope";
import { FaceView } from "./face";
import {
  LifelikeAssemblyView,
  LifelikeFaceView,
  lifelikeFrame,
} from "./lifelike";
import { FOLLOW_LIGHT } from "./materials";
import { sealOutline, sealReach } from "./wax-seal";

const invitation = parseDocument(eucaliptInvitation);
const context = { fields: eucaliptFields, assets: () => undefined };

function change(
  document: DesignDocument,
  ops: Parameters<typeof applyOperations>[1],
) {
  const result = applyOperations(document, ops);
  if (!result.ok) throw new Error(result.error);
  return result.document;
}

const contains = (
  outer: { x: number; y: number; width: number; height: number },
  inner: typeof outer,
) =>
  outer.x <= inner.x &&
  outer.y <= inner.y &&
  outer.x + outer.width >= inner.x + inner.width &&
  outer.y + outer.height >= inner.y + inner.height;

describe("FaceView", () => {
  test("keeps its paper texture unless asked to leave it plain", () => {
    // The lifelike view lays its own grain; the plain view keeps its own.
    const markup = renderToStaticMarkup(
      <FaceView document={invitation} piece="card" context={context} />,
    );
    expect(markup).toContain("feTurbulence");
    expect(markup).not.toContain(FOLLOW_LIGHT);
  });
});

describe("lifelike views", () => {
  test("draw the printing and the light, with no grain on the server", () => {
    const markup = renderToStaticMarkup(
      <LifelikeAssemblyView document={invitation} context={context} />,
    );
    expect(markup).toContain("Ana");
    // Foil catches the light where the pointer is.
    expect(markup).toContain(FOLLOW_LIGHT);
    // Tiles are drawn in the browser, so the server's markup has none.
    expect(markup).not.toContain("data:image/png");
  });

  // Moving the light repaints only the layer it's set on: the still one,
  // with its shadows and grain, must not depend on it.
  test("keep what moves with the light in a layer of its own", () => {
    const markup = renderToStaticMarkup(
      <LifelikeAssemblyView document={invitation} context={context} />,
    );
    const [still = "", light = ""] = markup.split("<svg").slice(1);
    expect(still).not.toContain(FOLLOW_LIGHT);
    expect(light).toContain("data-lifelike-light");
    expect(light).toContain(FOLLOW_LIGHT);
    // The card alone, printed in ink only, has nothing to catch the light.
    const card = {
      ...invitation,
      pieces: invitation.pieces.filter((piece) => piece.id === "card"),
      accessories: [],
    };
    const matte = change(card, [
      {
        op: "updateLayer",
        piece: "card",
        face: "front",
        layer: "names",
        set: { ink: "print" },
      },
    ]);
    expect(
      renderToStaticMarkup(
        <LifelikeAssemblyView document={matte} context={context} />,
      ),
    ).not.toContain("data-lifelike-light");
  });

  test("draw one side of one piece", () => {
    const markup = renderToStaticMarkup(
      <LifelikeFaceView
        document={invitation}
        piece="vellum"
        context={context}
        title="Vellum"
      />,
    );
    expect(markup).toContain("12.06.2027");
    expect(markup).not.toContain("Ana");
    expect(markup).toContain("<title>Vellum</title>");
  });

  test("frame the pieces, the envelope behind them and the seal", () => {
    const frame = lifelikeFrame(invitation, { kind: "assembly" });
    const envelope = envelopeLayout(invitation);
    expect(envelope).not.toBeNull();
    if (!envelope) return;
    expect(contains(frame, assemblyBounds(invitation))).toBe(true);
    expect(contains(frame, envelopeBox(envelope))).toBe(true);
    const face = lifelikeFrame(invitation, { kind: "face", piece: "vellum" });
    expect(face.width).toBeLessThan(frame.width);
  });
});

describe("envelopeLayout", () => {
  test("lies behind the pieces, a little larger and turned", () => {
    const layout = envelopeLayout(invitation);
    const bounds = assemblyBounds(invitation);
    expect(layout?.width).toBeGreaterThan(bounds.width);
    expect(layout?.height).toBeGreaterThan(bounds.height);
    expect(layout?.rotation).not.toBe(0);
    expect(layout?.open).toBe(false);
  });

  test("opens its flap to show a liner, and reaches higher for it", () => {
    const lined = change(invitation, [
      {
        op: "setEnvelope",
        envelope: {
          style: "classic",
          color: "#efe9dc",
          liner: { color: "$accent" },
        },
      },
    ]);
    const closed = envelopeLayout(invitation);
    const open = envelopeLayout(lined);
    expect(open?.open).toBe(true);
    if (!closed || !open) return;
    expect(envelopeBox(open).y).toBeLessThan(envelopeBox(closed).y);
  });

  test("is absent without an envelope", () => {
    const bare = change(invitation, [{ op: "setEnvelope", envelope: null }]);
    expect(envelopeLayout(bare)).toBeNull();
  });
});

describe("wax seals", () => {
  test("are poured unevenly, the same way every time", () => {
    const reach = sealReach("seal");
    expect(reach).toEqual(sealReach("seal"));
    expect(reach).not.toEqual(sealReach("another"));
    expect(Math.min(...reach)).toBeGreaterThanOrEqual(0.9);
    expect(Math.max(...reach)).toBeLessThanOrEqual(1.1);
    expect(Math.max(...reach) - Math.min(...reach)).toBeGreaterThan(0.02);
  });

  test("have a closed outline round their centre", () => {
    const outline = sealOutline("seal", 12);
    expect(outline.startsWith("M")).toBe(true);
    expect(outline.endsWith("Z")).toBe(true);
  });
});
