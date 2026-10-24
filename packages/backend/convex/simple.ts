import { getAuthUserId } from "@convex-dev/auth/server";
import {
  assetKeys,
  type DesignDocument,
  type ProductKind,
  productKinds,
} from "@jolene/design";
import { ConvexError, v } from "convex/values";
import type { Doc } from "./_generated/dataModel";
import { mutation, query } from "./_generated/server";
import { aiConfig, MAX_MESSAGE_LENGTH } from "./ai/config";
import { messagesLeft } from "./ai/limits";
import {
  beginReply,
  canRetry,
  isWorking,
  latestMessage,
  queueReply,
} from "./ai/reply";
import { aiErrorValidator, aiStatusValidator } from "./ai/validators";
import { createDesign } from "./designs";
import { requireOwnDesign } from "./designs/access";
import { collectionDesigns, itemName, wroteDesign } from "./simple/compose";
import { MAX_LINE_LENGTH, offersTone, toneValidator } from "./simple/tones";
import { resolveAssets, resolvedAssetValidator } from "./utils/assets";
import { errors } from "./utils/errors";
import {
  documentValidator,
  labelsValidator,
  languageValidator,
  productKindValidator,
} from "./utils/validators";

/**
 * Simple mode: the couple picks a design, answers a few questions, and the
 * AI designer writes the wording and lays out the whole collection, item by
 * item (simple/compose.ts). Without the AI designer the questions still
 * start the items, in Jolene's wording with the couple's details.
 */

/** The collection's templates simple mode looks through. */
const MAX_TEMPLATES = 50;

/** Designs one progress query follows. */
const MAX_FOLLOWED = 50;

/**
 * The event's designs from the collection a design was started from, in
 * the collection's order, for simple mode's view of the whole suite.
 */
export const collection = query({
  args: { designId: v.id("designs") },
  returns: v.union(
    v.object({
      suite: v.object({ slug: v.string(), name: labelsValidator }),
      designs: v.array(
        v.object({
          _id: v.id("designs"),
          kind: productKindValidator,
          revision: v.number(),
          document: documentValidator,
        }),
      ),
      assets: v.array(resolvedAssetValidator),
    }),
    v.null(),
  ),
  handler: async (ctx, { designId }) => {
    const viewerId = await getAuthUserId(ctx);
    const design = await ctx.db.get("designs", designId);
    if (!design || design.ownerId !== viewerId) return null;
    const template = await ctx.db.get("templates", design.templateId);
    const suite = template && (await ctx.db.get("suites", template.suiteId));
    if (!suite) return null;
    const designs = (
      await collectionDesigns(ctx, design.eventId, suite._id)
    ).map(({ design }) => design);
    return {
      suite: { slug: suite.slug, name: suite.name },
      designs: designs.map(({ _id, kind, revision, document }) => ({
        _id,
        kind,
        revision,
        document,
      })),
      assets: await resolveAssets(
        ctx,
        designs.flatMap((each) => assetKeys(each.document as DesignDocument)),
        viewerId,
      ),
    };
  },
});

/**
 * Where the AI designer stands on each design: its latest reply. Designs
 * with no reply, or someone else's, are left out.
 */
export const progress = query({
  args: { designIds: v.array(v.id("designs")) },
  returns: v.array(
    v.object({
      designId: v.id("designs"),
      replyId: v.id("aiMessages"),
      status: aiStatusValidator,
      error: v.optional(aiErrorValidator),
      /** The reply writes an item simple mode asked for. */
      composed: v.boolean(),
      /** It left its own words on the design, not undone since. */
      wrote: v.boolean(),
      /** It failed for a passing reason, and can run again (ai.retry). */
      canRetry: v.boolean(),
      /** The rendering it waits for (ai.answerRendering). */
      rendering: v.optional(
        v.object({
          toolUseId: v.string(),
          revision: v.number(),
          view: v.optional(v.string()),
        }),
      ),
    }),
  ),
  handler: async (ctx, { designIds }) => {
    const viewerId = await getAuthUserId(ctx);
    if (!viewerId) return [];
    const replies = await Promise.all(
      designIds
        .slice(0, MAX_FOLLOWED)
        .map((designId) => latestMessage(ctx, designId)),
    );
    return replies.flatMap((reply) =>
      reply?.role === "designer" && reply.ownerId === viewerId
        ? [
            {
              designId: reply.designId,
              replyId: reply._id,
              status: reply.status,
              ...(reply.error ? { error: reply.error } : {}),
              composed: reply.composition !== undefined,
              wrote: wroteDesign(reply),
              canRetry: canRetry(reply),
              ...(reply.rendering ? { rendering: reply.rendering } : {}),
            },
          ]
        : [],
    );
  },
});

/**
 * Simple mode's questions answered: starts a design for each item the couple
 * chose (or keeps the one they have of it in this event and collection),
 * keeps how they want the wording on their event, and asks the AI designer
 * to write each item, the invitation first. The day's messages are counted
 * as for any message: items they don't cover keep Jolene's wording, and so
 * do items whose design is still busy with a reply. Without the AI designer,
 * only the designs start.
 */
export const compose = mutation({
  args: {
    /** The design simple mode is open on: its item is always among them. */
    designId: v.id("designs"),
    /**
     * The items to write, each with the couple's request in the studio's
     * language, as it shows in the item's conversation.
     */
    items: v.array(
      v.object({ kind: productKindValidator, request: v.string() }),
    ),
    tone: v.optional(toneValidator),
    /** A line of their own: a verse, a quote, something about them. */
    line: v.optional(v.string()),
    /** The language of the cards. */
    language: languageValidator,
    /** The studio's language, which the replies are written in. */
    locale: languageValidator,
  },
  returns: v.object({
    items: v.array(
      v.object({
        kind: productKindValidator,
        designId: v.id("designs"),
        /** The AI designer writes it; false keeps Jolene's wording. */
        written: v.boolean(),
      }),
    ),
  }),
  handler: async (ctx, args) => {
    const opened = await requireOwnDesign(ctx, args.designId);
    const event = await ctx.db.get("events", opened.eventId);
    const template = await ctx.db.get("templates", opened.templateId);
    if (!event || !template) throw new ConvexError(errors.notFound);
    const kinds = new Set(args.items.map((item) => item.kind));
    if (
      kinds.size === 0 ||
      kinds.size < args.items.length ||
      kinds.size > productKinds.length ||
      (args.tone && !offersTone(event.occasion, args.tone))
    )
      throw new ConvexError(errors.notFound);
    const line = args.line?.trim() ?? "";
    const requests = args.items.map(({ kind, request }) => ({
      kind,
      request: request.trim(),
    }));
    if (
      line.length > MAX_LINE_LENGTH ||
      requests.some(
        ({ request }) => !request || request.length > MAX_MESSAGE_LENGTH,
      )
    )
      throw new ConvexError(errors.aiInvalidMessage);

    // Each item's design: the open one for its item, else the couple's
    // latest of that item in this collection, else a new one.
    const templates = await ctx.db
      .query("templates")
      .withIndex("by_suiteId_and_retired_and_sortOrder", (q) =>
        q.eq("suiteId", template.suiteId).eq("retired", undefined),
      )
      .take(MAX_TEMPLATES);
    const existing = await collectionDesigns(ctx, event._id, template.suiteId);
    const ownOf = (kind: ProductKind) =>
      kind === opened.kind
        ? { design: opened, template }
        : existing
            .filter(({ design }) => design.kind === kind)
            .sort((a, b) => b.design.updatedAt - a.design.updatedAt)[0];
    const chosen = requests.map(({ kind, request }) => {
      const own = ownOf(kind);
      const start = templates.find((each) => each.kind === kind);
      const order = (own?.template ?? start)?.sortOrder;
      if (order === undefined) throw new ConvexError(errors.notFound);
      return {
        kind,
        request,
        own: own?.design,
        start,
        order: kind === "invitation" ? -1 : order,
      };
    });
    chosen.sort((a, b) => a.order - b.order);
    const items: {
      kind: ProductKind;
      request: string;
      design: Doc<"designs">;
    }[] = [];
    for (const { kind, request, own, start } of chosen) {
      const design =
        own ??
        (start &&
          (await ctx.db.get(
            "designs",
            await createDesign(ctx, {
              ownerId: opened.ownerId,
              eventId: event._id,
              template: start,
            }),
          )));
      if (!design) throw new Error("The design was just started");
      items.push({ kind, request, design });
    }

    const config = aiConfig();
    const planned: typeof items = [];
    if (config.configured) {
      const now = Date.now();
      await ctx.db.patch("events", event._id, {
        wording: {
          ...(args.tone ? { tone: args.tone } : {}),
          ...(line ? { line } : {}),
          language: args.language,
        },
        updatedAt: now,
      });
      const left = await messagesLeft(ctx, opened.ownerId, config, now);
      let room = Math.min(left.visitor, left.everyone);
      for (const item of items) {
        if (room <= 0) break;
        const latest = await latestMessage(ctx, item.design._id);
        if (latest && isWorking(latest)) continue;
        planned.push(item);
        room -= 1;
      }
      const [lead, ...later] = planned;
      if (lead) {
        const compositionId = await ctx.db.insert("compositions", {
          ownerId: opened.ownerId,
          eventId: event._id,
          suiteId: template.suiteId,
          items: [],
          updatedAt: now,
        });
        const queue = (item: (typeof items)[number], first: boolean) =>
          queueReply(ctx, {
            design: item.design,
            text: item.request,
            locale: args.locale,
            status: first ? "pending" : "waiting",
            composition: compositionId,
          });
        const leadReply = await queue(lead, true);
        const replies = [leadReply];
        for (const item of later) replies.push(await queue(item, false));
        await ctx.db.patch("compositions", compositionId, {
          items: replies.map((reply) => ({
            designId: reply.designId,
            replyId: reply._id,
          })),
        });
        await beginReply(ctx, leadReply, {
          composition: {
            items: planned.map((item) => itemName(item.kind)),
            item: itemName(lead.kind),
          },
        });
      }
    }
    return {
      items: items.map((item) => ({
        kind: item.kind,
        designId: item.design._id,
        written: planned.includes(item),
      })),
    };
  },
});
