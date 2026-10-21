import type { DesignDocument, Language } from "@jolene/design";
import { v } from "convex/values";
import type { Doc } from "./_generated/dataModel";
import { internalMutation, type MutationCtx } from "./_generated/server";
import { ensureInvite } from "./invites";
import { DIGITAL_INVITE_SKU } from "./orders/shopify";

/**
 * What a paid Shopify order does in the studio: a digital invitation bought
 * for an event, or printed invitations of an event's design (free with
 * them), unlock the event's digital invitation for all its guests.
 */

/** Printed invitations: a line of fewer is a sample, not the event's. */
const MIN_PRINTED = 10;

/** The language an event's digital invitation starts in: its invitation's. */
async function eventLanguage(
  ctx: MutationCtx,
  event: Doc<"events">,
): Promise<Language> {
  const designs = await ctx.db
    .query("designs")
    .withIndex("by_eventId", (q) => q.eq("eventId", event._id))
    .take(100);
  const invitation = designs.find((design) => design.kind === "invitation");
  return (invitation?.document as DesignDocument | undefined)?.language ?? "ro";
}

async function unlock(
  ctx: MutationCtx,
  event: Doc<"events">,
  by: "order" | "print",
  order: string,
  language?: Language,
) {
  const invite = await ensureInvite(
    ctx,
    event,
    language ?? (await eventLanguage(ctx, event)),
  );
  if (invite.unlocked) return false;
  await ctx.db.patch("invites", invite._id, {
    unlocked: { by, order, at: Date.now() },
    updatedAt: Date.now(),
  });
  return true;
}

/**
 * Unlocks what a paid order's lines are for, from Shopify's orders/paid
 * webhook (http.ts). The same order twice changes nothing. Says how many
 * invitations it unlocked.
 */
export const paid = internalMutation({
  args: {
    order: v.string(),
    lines: v.array(
      v.object({
        sku: v.union(v.string(), v.null()),
        quantity: v.number(),
        event: v.union(v.string(), v.null()),
        proof: v.union(v.string(), v.null()),
      }),
    ),
  },
  returns: v.number(),
  handler: async (ctx, { order, lines }) => {
    let unlocked = 0;
    for (const line of lines) {
      if (line.event && line.sku === DIGITAL_INVITE_SKU) {
        const eventId = ctx.db.normalizeId("events", line.event);
        const event = eventId && (await ctx.db.get("events", eventId));
        if (event && (await unlock(ctx, event, "order", order))) unlocked++;
      }
      if (line.proof && line.quantity >= MIN_PRINTED) {
        const proofId = ctx.db.normalizeId("proofs", line.proof);
        const proof = proofId && (await ctx.db.get("proofs", proofId));
        if (proof?.kind !== "invitation") continue;
        const design = await ctx.db.get("designs", proof.designId);
        const event = design && (await ctx.db.get("events", design.eventId));
        const language = (proof.document as DesignDocument).language;
        if (event && (await unlock(ctx, event, "print", order, language)))
          unlocked++;
      }
    }
    if (unlocked > 0) console.log(`Order ${order} unlocked ${unlocked}`);
    return unlocked;
  },
});
