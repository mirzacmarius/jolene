import {
  type DesignDocument,
  type ProductKind,
  productKindLabels,
} from "@jolene/design";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { type CompositionContext, wordingOf } from "../ai/context";
import { beginReply, begun, canRetry, latestMessage } from "../ai/reply";

/**
 * Simple mode's AI flow over a collection: the AI designer writes the
 * wording of each item the couple chose and lays it out, each item in its
 * design's own conversation. The first item (the invitation, when chosen)
 * begins at once; the others wait for its reply to end, then begin together
 * with its wording to echo, so the collection speaks with one voice. When
 * the first item fails and can run again, the others fail with it, and run
 * again with it.
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

/** A reply's composition, with each item's design, when it writes an item. */
async function compositionOf(ctx: QueryCtx, reply: Doc<"aiMessages">) {
  const composition =
    reply.composition && (await ctx.db.get("compositions", reply.composition));
  if (!composition) return null;
  const designs = await Promise.all(
    composition.items.map((item) => ctx.db.get("designs", item.designId)),
  );
  return { composition, designs };
}

type Found = NonNullable<Awaited<ReturnType<typeof compositionOf>>>;

/**
 * What a composition's item begins with: the items, which one it is, and
 * the first item's wording to follow, when its reply wrote any.
 */
async function itemContext(
  ctx: QueryCtx,
  { composition, designs }: Found,
  index: number,
): Promise<CompositionContext> {
  const design = designs[index];
  if (!design) throw new Error("The design is gone");
  const lead = designs[0];
  const first = composition.items[0];
  const follows =
    lead && first && wroteDesign(await ctx.db.get("aiMessages", first.replyId))
      ? wordingOf(lead.document as DesignDocument)
      : undefined;
  return {
    items: designs.flatMap((each) => (each ? [itemName(each.kind)] : [])),
    item: itemName(design.kind),
    ...(follows ? { follows } : {}),
  };
}

/**
 * Begins a later item of a composition. One that can't begin fails on its
 * own, refunded, so the first item's end is kept whatever happens to it.
 */
async function beginItem(
  ctx: MutationCtx,
  found: Found,
  index: number,
  reply: Doc<"aiMessages">,
) {
  try {
    await beginReply(ctx, reply, {
      composition: await itemContext(ctx, found, index),
    });
  } catch (error) {
    // beginReply checks everything before it writes, so nothing of the
    // item's is left half begun.
    console.error(
      `Composition item could not begin (reply ${reply._id}):`,
      error instanceof Error ? error.message : String(error),
    );
    // What stopped it would stop it again, so it can't run again: the next
    // message on its design starts afresh.
    const now = Date.now();
    await ctx.db.patch("aiMessages", reply._id, {
      status: "failed",
      error: "failed",
      endsThread: true,
      refunded: true,
      finishedAt: now,
      updatedAt: now,
    });
  }
}

/**
 * Called when a reply ends, however it ends (done, failed, stopped): when
 * it wrote a composition's first item, the items waiting for it go on. If
 * it failed and can run again, they fail with it, refunded, and wait for it
 * again when it runs again (waitAgain); otherwise they begin, with its
 * wording if it wrote any.
 */
export async function afterReply(
  ctx: MutationCtx,
  reply: Doc<"aiMessages">,
): Promise<void> {
  const found = await compositionOf(ctx, reply);
  const [first, ...later] = found?.composition.items ?? [];
  if (!found || first?.replyId !== reply._id) return;
  // The reply as it ended, which the caller has just written.
  const ended = await ctx.db.get("aiMessages", reply._id);
  const failedWith = ended && canRetry(ended) ? ended.error : undefined;
  const now = Date.now();
  for (const [index, item] of later.entries()) {
    const waiting = await ctx.db.get("aiMessages", item.replyId);
    if (waiting?.status !== "waiting") continue;
    if (failedWith)
      await ctx.db.patch("aiMessages", waiting._id, {
        status: "failed",
        error: failedWith,
        refunded: true,
        finishedAt: now,
        updatedAt: now,
      });
    else await beginItem(ctx, found, index + 1, waiting);
  }
  await ctx.db.patch("compositions", found.composition._id, {
    updatedAt: now,
  });
}

/**
 * When a composition's first item runs again (ai.retry), the items that
 * failed with it wait for it again, as many as `room` more messages allow.
 * An item whose design has had a message since stays as it is.
 */
export async function waitAgain(
  ctx: MutationCtx,
  lead: Doc<"aiMessages">,
  room: number,
): Promise<void> {
  const found = await compositionOf(ctx, lead);
  const [first, ...later] = found?.composition.items ?? [];
  if (!found || first?.replyId !== lead._id) return;
  const now = Date.now();
  let left = room;
  for (const item of later) {
    const reply = await ctx.db.get("aiMessages", item.replyId);
    if (!reply || begun(reply) || !canRetry(reply)) continue;
    if (reply.refunded && left <= 0) break;
    if ((await latestMessage(ctx, reply.designId))?._id !== reply._id) continue;
    await ctx.db.patch("aiMessages", reply._id, {
      status: "waiting",
      error: undefined,
      refunded: undefined,
      finishedAt: undefined,
      updatedAt: now,
    });
    if (reply.refunded) left -= 1;
  }
  await ctx.db.patch("compositions", found.composition._id, {
    updatedAt: now,
  });
}

/**
 * Begins, on its own, a composition's later item that failed with the
 * first item (ai.retry): with the first item's wording to follow, if it has
 * written any since.
 */
export async function beginOnItsOwn(
  ctx: MutationCtx,
  reply: Doc<"aiMessages">,
): Promise<void> {
  const found = await compositionOf(ctx, reply);
  const index =
    found?.composition.items.findIndex((item) => item.replyId === reply._id) ??
    -1;
  await beginReply(
    ctx,
    reply,
    found && index > 0
      ? { composition: await itemContext(ctx, found, index) }
      : {},
  );
}
