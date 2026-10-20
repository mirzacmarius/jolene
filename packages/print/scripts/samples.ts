// Makes the print file of every template, with its collection's example
// details, for the workshop to check: bun scripts/samples.ts <output folder>
// Fonts come from Google Fonts, artwork from the studio's public folder.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  parseDocument,
  previewFields,
  productKindLabels,
} from "@jolene/design";
import { suites } from "@jolene/suites";
import { FontBook, googleFonts, makePrintFile } from "../src";

const [output, only] = process.argv.slice(2);
if (!output)
  throw new Error("Usage: bun scripts/samples.ts <output folder> [template]");
const studioPublic = join(import.meta.dir, "../../../apps/studio/public");
const fonts = new FontBook(googleFonts());
mkdirSync(output, { recursive: true });

for (const suite of suites) {
  for (const template of suite.templates) {
    if (only && template.slug !== only) continue;
    const document = parseDocument(template.document);
    const started = performance.now();
    const file = await makePrintFile({
      document,
      fields: previewFields(
        document.occasion,
        document.language,
        suite.sampleFields,
      ),
      title: `${suite.name.ro} · ${productKindLabels[document.kind].ro}`,
      fonts,
      asset: async (key) => {
        const art = suite.art[key];
        if (!art) return null;
        return {
          bytes: readFileSync(join(studioPublic, art.path)),
          recolorable: art.recolorable ?? false,
        };
      },
    });
    writeFileSync(join(output, `${template.slug}.pdf`), file.pdf);
    const issues = file.issues.map((issue) =>
      issue.kind === "low-resolution"
        ? `${issue.layer} ${issue.dpi} dpi`
        : JSON.stringify(issue),
    );
    console.info(
      `${template.slug}: ${file.pages.length} pages, ${(file.pdf.length / 1024).toFixed(0)} KB, ${Math.round(performance.now() - started)} ms${issues.length ? `\n  ${issues.join("\n  ")}` : ""}`,
    );
  }
}
