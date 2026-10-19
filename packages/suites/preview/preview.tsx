import {
  faceNames,
  googleFontsHref,
  parseDocument,
  previewFields,
} from "@jolene/design";
import {
  AssemblyView,
  FaceView,
  type RenderContext,
  useCanvasMeasure,
} from "@jolene/design/react";
import { useMemo } from "react";
import { createRoot } from "react-dom/client";
import { type Suite, suites } from "../src";

const fonts = document.createElement("link");
fonts.rel = "stylesheet";
fonts.href = googleFontsHref();
document.head.append(fonts);

const params = new URLSearchParams(location.search);
const only = params.get("suite");
const language = params.get("language") === "en" ? "en" : "ro";
// Millimetres to pixels on the sheet.
const scale = Number(params.get("scale") ?? 2.6);

function SuiteSheet({ suite }: { suite: Suite }) {
  const measure = useCanvasMeasure();
  const context = useMemo<RenderContext>(
    () => ({
      fields: previewFields(suite.occasion, language, suite.sampleFields),
      assets: (key) => {
        const artwork = suite.art[key];
        return artwork ? { url: artwork.path, recolorable: false } : undefined;
      },
      measure,
    }),
    [suite, measure],
  );
  return (
    <section>
      <h2>{suite.name[language]}</h2>
      {suite.templates.map((template) => {
        const document = parseDocument(template.document);
        const width = Math.max(...document.pieces.map((piece) => piece.width));
        return (
          <div
            key={template.slug}
            className="template"
            data-template={template.slug}
          >
            <div className="face">
              <h3>{template.slug}</h3>
              <div style={{ width: width * scale }}>
                <AssemblyView document={document} context={context} />
              </div>
            </div>
            {document.pieces.flatMap((piece) =>
              faceNames
                .filter((face) => piece[face])
                .map((face) => (
                  <div key={`${piece.id}-${face}`} className="face">
                    <h3>
                      {piece.id} · {face}
                    </h3>
                    <div
                      style={{ width: (piece.width + 2 * piece.bleed) * scale }}
                    >
                      <FaceView
                        document={document}
                        piece={piece.id}
                        face={face}
                        guides
                        context={context}
                      />
                    </div>
                  </div>
                )),
            )}
          </div>
        );
      })}
    </section>
  );
}

const root = document.getElementById("root");
if (root)
  createRoot(root).render(
    suites
      .filter((suite) => !only || suite.slug === only)
      .map((suite) => <SuiteSheet key={suite.slug} suite={suite} />),
  );
