import { googleFontsHref, parseDocument, previewFields } from "@jolene/design";
import {
  LifelikeAssemblyView,
  lifelikeFrame,
  type RenderContext,
  useCanvasMeasure,
} from "@jolene/design/react";
import { useMemo } from "react";
import { createRoot } from "react-dom/client";
import { suites } from "../src";

const fonts = document.createElement("link");
fonts.rel = "stylesheet";
fonts.href = googleFontsHref();
document.head.append(fonts);

const params = new URLSearchParams(location.search);
const suite = suites.find(({ slug }) => slug === params.get("suite"));
// CSS pixels across the picture, shadow included.
const width = Number(params.get("width") ?? 1320);
// The shadow falls past the view's frame.
const margin = 24;

const template = suite?.templates.find(
  ({ document }) => document.kind === "invitation",
);
const invitation = template && parseDocument(template.document);

function Shot() {
  const measure = useCanvasMeasure();
  const context = useMemo<RenderContext | undefined>(
    () =>
      suite && {
        fields: previewFields(suite.occasion, "ro", suite.sampleFields),
        assets: (key) => {
          const artwork = suite.art[key];
          return artwork
            ? { url: artwork.path, recolorable: artwork.recolorable ?? false }
            : undefined;
        },
        measure,
      },
    [measure],
  );
  if (!suite || !invitation || !context) return null;
  const inner = width - 2 * margin;
  const frame = lifelikeFrame(invitation, { kind: "assembly" });
  return (
    <main style={{ display: "inline-block", padding: margin }}>
      <div style={{ width: inner }}>
        <LifelikeAssemblyView
          document={invitation}
          context={context}
          pixelsPerMm={inner / frame.width}
          title={suite.name.ro}
        />
      </div>
    </main>
  );
}

// The artwork is in the cache before the first draw, and the fonts are in
// before the page says it's ready; the renderer then measures with them.
await Promise.all(
  Object.values(suite?.art ?? {}).map(
    ({ path }) =>
      new Promise((resolve) => {
        const image = new Image();
        image.onload = image.onerror = resolve;
        image.src = path;
      }),
  ),
);
const root = document.getElementById("root");
if (root) createRoot(root).render(<Shot />);
await document.fonts.ready;
setTimeout(() => {
  document.body.dataset.ready = "true";
}, 1500);
