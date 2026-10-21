import { getAuthUserId } from "@convex-dev/auth/server";
import { ConvexError, v } from "convex/values";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import {
  env,
  internalMutation,
  type MutationCtx,
  query,
} from "./_generated/server";
import { moveOwnership } from "./accounts/move";
import {
  emailConfigured,
  fromHeader,
  sendEmail,
  sender,
  signInCodeEmail,
} from "./emails";
import { errors } from "./utils/errors";
import { rateLimiter } from "./utils/limits";

/**
 * Couples design without an account, and sign in to one when their work
 * should outlive the browser: to keep a guest list, or share an event with
 * their partner. They sign in with a code sent to their email (auth.ts);
 * what they made anonymously moves to the account as they do.
 */

/** How long a sign-in code works. */
export const CODE_MINUTES = 15;

/** Documents moved in the sign-in itself; the rest move just after. */
const MOVED_AT_SIGN_IN = 200;

/** Who's signed in, for the studio's account page and its sign-in form. */
export const me = query({
  args: {},
  returns: v.object({
    /** Nobody yet, an anonymous visitor, or an account. */
    kind: v.union(
      v.literal("none"),
      v.literal("anonymous"),
      v.literal("account"),
    ),
    email: v.union(v.string(), v.null()),
    /** Sign-in codes can go out from this deployment. */
    emailSignIn: v.boolean(),
  }),
  handler: async (ctx) => {
    const emailSignIn = emailConfigured() || env.AUTH_LOG_CODES === "1";
    const userId = await getAuthUserId(ctx);
    const user = userId ? await ctx.db.get("users", userId) : null;
    if (!user) return { kind: "none" as const, email: null, emailSignIn };
    if (user.isAnonymous || !user.email)
      return { kind: "anonymous" as const, email: null, emailSignIn };
    return { kind: "account" as const, email: user.email, emailSignIn };
  },
});

/**
 * Sends a sign-in code, from Convex Auth's email provider (auth.ts). An
 * address gets a few codes an hour, and everyone together a few hundred, so
 * no one can mail the world through the studio.
 */
export const sendCode = internalMutation({
  args: { email: v.string(), code: v.string() },
  returns: v.null(),
  handler: async (ctx, { email, code }) => {
    const mine = await rateLimiter.limit(ctx, "signInCode", { key: email });
    const everyone = await rateLimiter.limit(ctx, "signInCodes");
    if (!mine.ok || !everyone.ok) throw new ConvexError(errors.tooMany);
    if (env.AUTH_LOG_CODES === "1" && !emailConfigured()) {
      console.log(`Sign-in code for ${email}: ${code}`);
      return null;
    }
    const { name, address } = sender();
    await sendEmail(ctx, {
      to: email,
      from: fromHeader(name, address),
      ...signInCodeEmail(code, CODE_MINUTES),
    });
    return null;
  },
});

/**
 * When a visitor signs in, what they made anonymously in this browser
 * becomes their account's: Convex Auth calls this as it opens the
 * account's session, while the request still carries the anonymous one.
 */
export async function claimAnonymousWork(
  ctx: MutationCtx,
  userId: Id<"users">,
) {
  const previousId = await getAuthUserId(ctx);
  if (!previousId || previousId === userId) return;
  const [previous, account] = await Promise.all([
    ctx.db.get("users", previousId),
    ctx.db.get("users", userId),
  ]);
  if (!previous?.isAnonymous || !account || account.isAnonymous) return;
  const done = await moveOwnership(ctx, previousId, userId, MOVED_AT_SIGN_IN);
  if (!done)
    await ctx.scheduler.runAfter(0, internal.accounts.moveRest, {
      from: previousId,
      to: userId,
    });
}

/** Moves the rest of an anonymous visitor's work, a batch at a time. */
export const moveRest = internalMutation({
  args: { from: v.id("users"), to: v.id("users") },
  returns: v.null(),
  handler: async (ctx, { from, to }) => {
    const done = await moveOwnership(ctx, from, to, 500);
    if (!done)
      await ctx.scheduler.runAfter(0, internal.accounts.moveRest, { from, to });
    return null;
  },
});
