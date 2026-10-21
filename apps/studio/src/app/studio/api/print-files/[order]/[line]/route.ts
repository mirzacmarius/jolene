import { readFile } from "node:fs/promises";
import { join, resolve, sep } from "node:path";
import { api } from "@jolene/backend/convex/_generated/api";
import { orderNumber } from "@jolene/backend/convex/orders/format";
import {
  parseDocument,
  productKindLabels,
  type TextLayout,
} from "@jolene/design";
import { FontBook, googleFonts, makePrintFile } from "@jolene/print";
import { fetchQuery } from "convex/nextjs";
import { ConvexError } from "convex/values";
import {
  PRINT_CHECK_HEADER,
  PRINT_ISSUES_LISTED,
  type PrintNote,
  writePrintCheck,
} from "@/components/workshop/print-check";
import { env } from "@/env";

/** A file takes a few seconds: its faces, its pictures, a page per plate. */
export const maxDuration = 60;

/**
 * The faces print files are set in, from Google Fonts (docs/adr/0006), kept
 * for the next file while the function stays warm.
 */
const fonts = new FontBook(googleFonts());

/** Jolene's artwork, which ships with the studio (docs/adr/0005). */
const publicFolder = join(process.cwd(), "public");
const artFolder = join(publicFolder, "studio", "art");

/** The longest piece of a text an issue quotes. */
const EXCERPT_LENGTH = 40;

/**
 * An asset's file: Jolene's artwork from the studio's own files, a couple's
 * photo from Convex storage. Null when there is no such file.
 */
async function assetFile(url: string): Promise<Uint8Array | null> {
  if (url.startsWith("/")) {
    const file = resolve(publicFolder, `.${url}`);
    if (!file.startsWith(artFolder + sep)) return null;
    return await readFile(file).then(
      (bytes) => new Uint8Array(bytes),
      () => null,
    );
  }
  if (!url.startsWith(`${new URL(env.NEXT_PUBLIC_CONVEX_URL).origin}/`))
    return null;
  const response = await fetch(url, { cache: "no-store" });
  return response.ok ? new Uint8Array(await response.arrayBuffer()) : null;
}

/** A text's words, cut short for an issue to quote. */
function excerpt(layout: TextLayout | undefined) {
  const text = layout?.lines.map((line) => line.text.trim()).join(" ") ?? "";
  return text.length > EXCERPT_LENGTH
    ? `${text.slice(0, EXCERPT_LENGTH).trimEnd()}…`
    : text;
}

/** A download's name, as browsers read it: UTF-8, with a plain fallback. */
function attachment(name: string) {
  const plain = name
    .normalize("NFKD")
    .replace(/[^\x20-\x7e]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  const encoded = encodeURIComponent(name).replace(
    /['()]/g,
    (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`,
  );
  return `attachment; filename="${plain}"; filename*=UTF-8''${encoded}`;
}

function failure(status: number, error: string, message?: string) {
  return Response.json(
    { error, message },
    { status, headers: { "Cache-Control": "no-store" } },
  );
}

/**
 * The print file of an order's designed line, such as J1001/0 for its first,
 * for the workshop (docs/adr/0010): the PDF of the line's proof, with what
 * its checks found in a header. The workshop's page sends its Convex token,
 * and Convex says whether it may have the file.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ order: string; line: string }> },
) {
  const token = /^Bearer (\S+)$/.exec(
    request.headers.get("authorization") ?? "",
  )?.[1];
  if (!token) return failure(401, "signed-out");
  const { order, line } = await params;
  const number = orderNumber(order);
  if (number === null || !/^\d{1,3}$/.test(line))
    return failure(404, "not-found");

  try {
    const job = await fetchQuery(
      api.workshop.printJob,
      { number, line: Number(line) },
      { url: env.NEXT_PUBLIC_CONVEX_URL, token },
    );
    if (!job) return failure(404, "not-found");
    const document = parseDocument(job.document);
    // Which order and job the pages are for, and how many to print.
    const title = [
      job.order,
      job.names,
      job.suite?.ro,
      `${productKindLabels[job.kind].ro} × ${job.quantity}`,
    ]
      .filter(Boolean)
      .join(" · ");
    const assets = new Map(job.assets.map((asset) => [asset.key, asset]));
    const file = await makePrintFile({
      document,
      fields: job.fields,
      title,
      fonts,
      asset: async (key) => {
        const asset = assets.get(key);
        const bytes = asset ? await assetFile(asset.url) : null;
        return asset && bytes
          ? { bytes, recolorable: asset.recolorable }
          : null;
      },
    });

    const pieces = new Map(
      document.pieces.map((piece) => [piece.id, piece.name ?? piece.id]),
    );
    const issues = file.issues.map((issue): PrintNote => {
      if (!("layer" in issue)) return issue;
      const text = excerpt(file.layouts[issue.layer]);
      return {
        ...issue,
        pieceName: pieces.get(issue.piece),
        ...(text ? { text } : {}),
      };
    });
    return new Response(new Uint8Array(file.pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": attachment(
          `${title.replace(/[\\/:*?"<>|\p{Cc}]+/gu, " ").trim() || "Jolene"}.pdf`,
        ),
        "Cache-Control": "private, no-store",
        [PRINT_CHECK_HEADER]: writePrintCheck({
          pages: file.pages.length,
          occasion: document.occasion,
          issues: issues.slice(0, PRINT_ISSUES_LISTED),
          total: issues.length,
        }),
      },
    });
  } catch (error) {
    if (error instanceof ConvexError && error.data === "workshop-only")
      return failure(403, "workshop-only");
    console.error(`Print file of ${order}'s line ${line} failed`, error);
    return failure(
      500,
      "failed",
      error instanceof Error ? error.message : String(error),
    );
  }
}
