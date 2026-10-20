import { ConvexError } from "convex/values";
import type { Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { errors } from "../utils/errors";
import { type AiConfig, startOfDay } from "./config";

/**
 * The day's limits on messages to the AI designer: each visitor's, and
 * everyone's together, which holds however many anonymous visitors there are.
 * Every message the couple sends counts, and so does every item simple mode
 * asks the AI designer to write, by the reply that answers it; a reply the
 * API never answered any of is refunded.
 */

/** How many of the day's messages the visitor has used since `since`. */
export async function messagesUsed(
  ctx: QueryCtx,
  ownerId: Id<"users">,
  since: number,
  limit: number,
) {
  const used = await ctx.db
    .query("aiMessages")
    .withIndex("by_ownerId_and_role_and_refunded", (q) =>
      q
        .eq("ownerId", ownerId)
        .eq("role", "designer")
        .eq("refunded", undefined)
        .gte("_creationTime", since),
    )
    .take(limit);
  return used.length;
}

/** How many more messages today allows: the visitor's, then everyone's. */
export async function messagesLeft(
  ctx: MutationCtx,
  ownerId: Id<"users">,
  config: AiConfig,
  now: number,
) {
  const since = startOfDay(now);
  const everyone = await ctx.db
    .query("aiMessages")
    .withIndex("by_role_and_refunded", (q) =>
      q
        .eq("role", "designer")
        .eq("refunded", undefined)
        .gte("_creationTime", since),
    )
    .take(config.totalDailyLimit);
  return {
    visitor:
      config.dailyLimit -
      (await messagesUsed(ctx, ownerId, since, config.dailyLimit)),
    everyone: config.totalDailyLimit - everyone.length,
  };
}

/** Throws when the messages left allow no more. */
export function requireRoom(left: { visitor: number; everyone: number }) {
  if (left.visitor <= 0) throw new ConvexError(errors.aiLimit);
  if (left.everyone <= 0) throw new ConvexError(errors.aiLimitTotal);
}

/** Throws when today allows the visitor no more messages. */
export async function checkLimits(
  ctx: MutationCtx,
  ownerId: Id<"users">,
  config: AiConfig,
  now: number,
) {
  requireRoom(await messagesLeft(ctx, ownerId, config, now));
}
