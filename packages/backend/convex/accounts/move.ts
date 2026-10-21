import type { Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";

/**
 * Moves what an anonymous visitor made to the account they signed in to:
 * their events, designs, proofs, the AI designer's messages (and so the
 * day's count of them), simple mode's compositions and their photos. A
 * design's versions and conversation follow its design by its id.
 *
 * Moves at most `budget` documents and says whether that was all of them;
 * the rest go in a scheduled mutation (accounts.moveRest).
 */
export async function moveOwnership(
  ctx: MutationCtx,
  from: Id<"users">,
  to: Id<"users">,
  budget: number,
): Promise<boolean> {
  let left = budget;

  const events = await ctx.db
    .query("events")
    .withIndex("by_ownerId_and_occasion", (q) => q.eq("ownerId", from))
    .take(left);
  for (const event of events)
    await ctx.db.patch("events", event._id, { ownerId: to });
  left -= events.length;
  if (left <= 0) return false;

  const designs = await ctx.db
    .query("designs")
    .withIndex("by_ownerId_and_updatedAt", (q) => q.eq("ownerId", from))
    .take(left);
  for (const design of designs)
    await ctx.db.patch("designs", design._id, { ownerId: to });
  left -= designs.length;
  if (left <= 0) return false;

  const proofs = await ctx.db
    .query("proofs")
    .withIndex("by_ownerId", (q) => q.eq("ownerId", from))
    .take(left);
  for (const proof of proofs)
    await ctx.db.patch("proofs", proof._id, { ownerId: to });
  left -= proofs.length;
  if (left <= 0) return false;

  const compositions = await ctx.db
    .query("compositions")
    .withIndex("by_ownerId", (q) => q.eq("ownerId", from))
    .take(left);
  for (const composition of compositions)
    await ctx.db.patch("compositions", composition._id, { ownerId: to });
  left -= compositions.length;
  if (left <= 0) return false;

  const messages = await ctx.db
    .query("aiMessages")
    .withIndex("by_ownerId_and_role_and_refunded", (q) => q.eq("ownerId", from))
    .take(left);
  for (const message of messages)
    await ctx.db.patch("aiMessages", message._id, { ownerId: to });
  left -= messages.length;
  if (left <= 0) return false;

  const photos = await ctx.db
    .query("assets")
    .withIndex("by_ownerId", (q) => q.eq("ownerId", from))
    .take(left);
  for (const photo of photos)
    await ctx.db.patch("assets", photo._id, { ownerId: to });
  left -= photos.length;
  return left > 0;
}
