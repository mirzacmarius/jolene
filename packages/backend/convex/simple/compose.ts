import {
  type DesignDocument,
  type ProductKind,
  productKindLabels,
} from "@jolene/design";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { wordingOf } from "../ai/context";
import { beginReply } from "../ai/reply";

/**
 * Simple mode's AI flow over a collection: the AI designer writes the
 * wording of each item the couple chose and lays it out, each item in its
 * design's own conversation. The first item (the invitation, when chosen)
 * begins at once; the others wait for its reply to end, then begin together
 * with its wording to echo, so the collection speaks with one voice.
 */

/** Designs of one event a collection's previews look through. */
const MAX_EVENT_DESIGNS = 100;

/** An item as the AI designer reads its name. */
export const itemName = (kind: ProductKind) => productKindLabels[kind].en;

/**
 * The event's designs started from one collection, in the collection's
 * order, the oldest first among designs of the same template.
 */
export async function collectionDesigns(
  ctx: QueryCtx,
  eventId: Id<"events">,
  suiteId: Id<"suites">,
): Promise<{ design: Doc<"designs">; template: Doc<"templates"> }[]> {
  const designs = await ctx.db
    .query("designs")
    .withIndex("by_eventId", (q) => q.eq("eventId", eventId))
    .take(MAX_EVENT_DESIGNS);
  const templates = new Map<Id<"templates">, Doc<"templates"> | null>();
  for (const design of designs)
    if (!templates.has(design.templateId))
      templates.set(
        design.templateId,
        await ctx.db.get("templates", design.templateId),
      );
  return designs
    .flatMap((design) => {
      const template = templates.get(design.templateId);
      return template?.suiteId === suiteId ? [{ design, template }] : [];
    })
    .sort(
      (a, b) =>
        a.template.sortOrder - b.template.sortOrder ||
        a.design._creationTime - b.design._creationTime,
    );
}

/**
 * Whether the reply left its own words on the design: a change it made that
 * the couple hasn't undone.
 */
export const wroteDesign = (reply: Doc<"aiMessages"> | null) =>
  reply?.changes?.some(
    (change) => change.kind === "design" && change.undoneAt === undefined,
  ) ?? false;

/**
 * Called when a reply ends, however it ends (done, failed, stopped): when
 * it wrote a composition's first item, the items waiting for it begin, with
 * its wording if it wrote any. A later item that can't begin fails on its
 * own, so the reply's end is kept whatever happens to the others.
 */
export async function afterReply(
  ctx: MutationCtx,
  reply: Doc<"aiMessages">,
): Promise<void> {
  if (!reply.composition) return;
  const composition = await ctx.db.get("compositions", reply.composition);
  const [first, ...later] = composition?.items ?? [];
  if (!composition || first?.replyId !== reply._id) return;

  const designs = await Promise.all(
    composition.items.map((item) => ctx.db.get("designs", item.designId)),
  );
  const items = designs.flatMap((design) =>
    design ? [itemName(design.kind)] : [],
  );
  const lead = designs[0];
  const follows =
    lead && wroteDesign(await ctx.db.get("aiMessages", first.replyId))
      ? wordingOf(lead.document as DesignDocument)
      : undefined;

  for (const [index, item] of later.entries()) {
    const waiting = await ctx.db.get("aiMessages", item.replyId);
    const design = designs[index + 1];
    if (waiting?.status !== "waiting") continue;
    try {
      if (!design) throw new Error("The design is gone");
      await beginReply(ctx, waiting, {
        composition: {
          items,
          item: itemName(design.kind),
          ...(follows ? { follows } : {}),
        },
      });
    } catch (error) {
      // beginReply checks everything before it writes, so nothing of the
      // item's is left half begun.
      console.error(
        `Composition item could not begin (reply ${waiting._id}):`,
        error instanceof Error ? error.message : String(error),
      );
      // It ends its thread, which it never began: the next message starts a
      // fresh one, and a retry can't send a thread it has none of.
      const now = Date.now();
      await ctx.db.patch("aiMessages", waiting._id, {
        status: "failed",
        error: "failed",
        endsThread: true,
        finishedAt: now,
        updatedAt: now,
      });
    }
  }
  await ctx.db.patch("compositions", composition._id, {
    updatedAt: Date.now(),
  });
}
