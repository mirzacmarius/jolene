import type { DesignDocument, Language } from "@jolene/design";
import { digitalInvitation } from "@jolene/products/digital-invitation";
import { v } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import {
  internalMutation,
  type MutationCtx,
  type QueryCtx,
} from "../_generated/server";
import { ensureInvite } from "../invites";
import type { Unlock } from "./validators";

/**
 * What opens an event's digital invitation to all its guests (ADR 0014): the
 * digital invitation bought for the event, printed invitations of the event's
 * design (free with them), or Jolene's team by hand.
 */

/** Printed invitations: a line of fewer is a sample, not the event's. */
const MIN_PRINTED = 10;

/** A line of a paid order, as the checkout records it. */
export type PaidLine = {
  /** The product's handle, as in /products/<handle>. */
  product: string;
  quantity: number;
  /** The event a digital invitation was bought for. */
  event?: Id<"events">;
  /** The proof printed invitations were ordered from (ADR 0007). */
  proof?: Id<"proofs">;
};

/**
 * The event whose digital invitation a line of printed invitations unlocks,
 * with its proof's language: at least ten from an invitation's proof. The
 * cart reads it too, as the digital invitation comes free with them.
 */
export async function printedInvitations(
  ctx: QueryCtx,
  line: { proof?: Id<"proofs">; quantity: number },
) {
  if (!line.proof || line.quantity < MIN_PRINTED) return null;
  const proof = await ctx.db.get("proofs", line.proof);
  if (proof?.kind !== "invitation") return null;
  const design = await ctx.db.get("designs", proof.designId);
  if (!design) return null;
  const { language } = proof.document as DesignDocument;
  return { eventId: design.eventId, language };
}

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
  how: Omit<Unlock, "at">,
  language?: Language,
) {
  const invite = await ensureInvite(
    ctx,
    event,
    language ?? (await eventLanguage(ctx, event)),
  );
  if (invite.unlocked) return false;
  await ctx.db.patch("invites", invite._id, {
    unlocked: { ...how, at: Date.now() },
    updatedAt: Date.now(),
  });
  return true;
}

/**
 * Unlocks what a paid order's lines are for. The checkout calls it in the
 * mutation that records the order as paid; the same order twice changes
 * nothing. Says how many invitations it unlocked.
 */
export async function unlockPaid(
  ctx: MutationCtx,
  order: string,
  lines: PaidLine[],
) {
  let unlocked = 0;
  for (const line of lines) {
    if (line.event && line.product === digitalInvitation.handle) {
      const event = await ctx.db.get("events", line.event);
      if (event && (await unlock(ctx, event, { by: "order", order })))
        unlocked++;
    }
    const printed = await printedInvitations(ctx, line);
    if (printed) {
      const event = await ctx.db.get("events", printed.eventId);
      if (
        event &&
        (await unlock(ctx, event, { by: "print", order }, printed.language))
      )
        unlocked++;
    }
  }
  if (unlocked > 0) console.log(`Order ${order} unlocked ${unlocked}`);
  return unlocked;
}

/**
 * Unlocks an event's digital invitation for a couple who paid Jolene some
 * other way. Jolene's team runs it from the Convex dashboard, with the event's
 * id from the couple's email and a note, such as the payment's reference.
 * Says whether it unlocked it; an invitation already open stays as it was.
 */
export const byHand = internalMutation({
  args: { event: v.string(), note: v.string() },
  returns: v.boolean(),
  handler: async (ctx, { event, note }) => {
    const eventId = ctx.db.normalizeId("events", event.trim());
    const found = eventId && (await ctx.db.get("events", eventId));
    if (!found) throw new Error(`No event has the id ${event}`);
    return await unlock(ctx, found, { by: "hand", order: note.trim() });
  },
});
