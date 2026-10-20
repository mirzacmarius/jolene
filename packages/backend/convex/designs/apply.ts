import {
  applyOperations,
  type DesignDocument,
  type Operation,
} from "@jolene/design";
import type { Doc } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { type Author, saveRevision } from "./versions";

export type Applied =
  | { ok: true; revision: number; document: DesignDocument }
  | {
      ok: false;
      /** "stale": the design changed since `expectedRevision`. */
      reason: "stale" | "invalid";
      message: string;
      revision: number;
    };

/**
 * Changes a design by operations (@jolene/design's ops.ts), all or nothing,
 * as its next revision: the editor's path and the AI designer's alike. With
 * `expectedRevision`, a design that has changed since is left as it is.
 */
export async function applyToDesign(
  ctx: MutationCtx,
  design: Doc<"designs">,
  operations: readonly Operation[],
  change: { author: Author; note?: string; expectedRevision?: number },
): Promise<Applied> {
  if (
    change.expectedRevision !== undefined &&
    change.expectedRevision !== design.revision
  ) {
    return {
      ok: false,
      reason: "stale",
      message: `The design is at revision ${design.revision}, not ${change.expectedRevision}`,
      revision: design.revision,
    };
  }
  const result = applyOperations(design.document as DesignDocument, operations);
  if (!result.ok)
    return {
      ok: false,
      reason: "invalid",
      message: result.error,
      revision: design.revision,
    };
  const revision = await saveRevision(ctx, design, result.document, {
    author: change.author,
    note: change.note,
  });
  return { ok: true, revision, document: result.document };
}
