import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { eucaliptFields, eucaliptInvitation } from "../samples";
import { parseDocument } from "../schema";
import { FaceView } from "./face";

const invitation = parseDocument(eucaliptInvitation);

/** The first line of the text that starts with `start`, as drawn. */
function line(markup: string, start: string) {
  const match = markup.match(
    new RegExp(
      `letter-spacing="([\\d.]+)"[^>]*><tspan x="([\\d.]+)"[^>]*>${start}`,
    ),
  );
  if (!match) throw new Error(`No line starts with ${start}`);
  return { spacing: Number(match[1]), x: Number(match[2]) };
}

function draw(piece: string) {
  return renderToStaticMarkup(
    <FaceView
      document={invitation}
      piece={piece}
      context={{ fields: eucaliptFields, assets: () => undefined }}
    />,
  );
}

describe("text layers", () => {
  // Browsers add letter spacing after the last letter too, then centre or
  // right-align the line with it.
  test("centre a tracked line on its letters", () => {
    const date = line(draw("card"), "SÂMBĂTĂ");
    expect(date.spacing).toBeGreaterThan(0);
    expect(date.x).toBeCloseTo(50 + date.spacing / 2);
  });

  test("end a right-aligned tracked line on its last letter", () => {
    const date = line(draw("vellum"), "12.06.2027");
    expect(date.spacing).toBeGreaterThan(0);
    expect(date.x).toBeCloseTo(42 + date.spacing);
  });
});
