import type { DesignDocument } from "@jolene/design";
import type { Infer } from "convex/values";
import type { Doc } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import type { authorValidator } from "../utils/validators";

export type Author = Infer<typeof authorValidator>;

/**
 * A person's edits fold into the version they started within this long, so
 * the versions list reads as sittings, not keystrokes.
 */
export const VERSION_SPAN_MS = 10 * 60 * 1000;

export interface Change {
  author: Author;
  note?: string;
  /** The revision a restore brings back. */
  restoredFrom?: number;
}

/**
 * Makes `document` the design's next revision and keeps it as a version: a
 * new one, or the latest when a person is still editing it.
 */
export async function saveRevision(
  ctx: MutationCtx,
  design: Doc<"designs">,
  document: DesignDocument,
  change: Change,
): Promise<number> {
  const revision = design.revision + 1;
  const now = Date.now();
  await ctx.db.patch("designs", design._id, {
    document,
    revision,
    updatedAt: now,
  });
  const latest = await ctx.db
    .query("designVersions")
    .withIndex("by_designId_and_revision", (q) => q.eq("designId", design._id))
    .order("desc")
    .first();
  const folds =
    latest !== null &&
    isPlainEdit(change) &&
    isPlainEdit(latest) &&
    now - latest._creationTime < VERSION_SPAN_MS;
  if (latest && folds) {
    await ctx.db.patch("designVersions", latest._id, {
      revision,
      document,
      updatedAt: now,
    });
  } else {
    await ctx.db.insert("designVersions", {
      designId: design._id,
      revision,
      document,
      ...change,
      updatedAt: now,
    });
  }
  return revision;
}

/** A person's edit without a note: the only kind that folds. */
const isPlainEdit = (change: Change) =>
  change.author === "person" &&
  change.note === undefined &&
  change.restoredFrom === undefined;
