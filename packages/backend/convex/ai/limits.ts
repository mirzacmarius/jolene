import { ConvexError } from "convex/values";
import type { Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { errors } from "../utils/errors";
import { type AiConfig, startOfDay } from "./config";

/**
 * The day's limits on messages to the AI designer: each visitor's, and
 * everyone's together, which holds however many anonymous visitors there are.
 * Every message the couple sends counts, and so does every item simple mode
 * asks the AI designer to write.
 */

/** How many more messages today allows: the visitor's, then everyone's. */
export async function messagesLeft(
  ctx: MutationCtx,
  ownerId: Id<"users">,
  config: AiConfig,
  now: number,
) {
  const since = startOfDay(now);
  const sent = await ctx.db
    .query("aiMessages")
    .withIndex("by_ownerId_and_role", (q) =>
      q.eq("ownerId", ownerId).eq("role", "couple").gte("_creationTime", since),
    )
    .take(config.dailyLimit);
  const everyone = await ctx.db
    .query("aiMessages")
    .withIndex("by_role", (q) =>
      q.eq("role", "couple").gte("_creationTime", since),
    )
    .take(config.totalDailyLimit);
  return {
    visitor: config.dailyLimit - sent.length,
    everyone: config.totalDailyLimit - everyone.length,
  };
}

/** Throws when today allows the visitor no more messages. */
export async function checkLimits(
  ctx: MutationCtx,
  ownerId: Id<"users">,
  config: AiConfig,
  now: number,
) {
  const left = await messagesLeft(ctx, ownerId, config, now);
  if (left.visitor <= 0) throw new ConvexError(errors.aiLimit);
  if (left.everyone <= 0) throw new ConvexError(errors.aiLimitTotal);
}
