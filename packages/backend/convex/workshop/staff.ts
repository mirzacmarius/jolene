import { getAuthUserId } from "@convex-dev/auth/server";
import { ConvexError } from "convex/values";
import { env, type QueryCtx } from "../_generated/server";
import { errors } from "../utils/errors";

/** The addresses in WORKSHOP_EMAILS, in lower case. */
function workshopEmails() {
  return new Set(
    (env.WORKSHOP_EMAILS ?? "")
      .split(",")
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean),
  );
}

/**
 * Who the workshop sees signed in: no one with an account, as for a couple
 * designing without one, or an account and whether it's one of the
 * workshop's. Accounts sign in with a code sent to their address (auth.ts),
 * which proves it's theirs.
 */
export async function workshopAccess(ctx: QueryCtx) {
  const userId = await getAuthUserId(ctx);
  const user = userId ? await ctx.db.get("users", userId) : null;
  if (!user?.email) return { signedIn: false as const };
  return {
    signedIn: true as const,
    email: user.email,
    allowed:
      user.emailVerificationTime !== undefined &&
      workshopEmails().has(user.email.toLowerCase()),
  };
}

/**
 * The email of the workshop's account signed in. Throws for anyone else,
 * including an account whose address the list doesn't have.
 */
export async function requireWorkshop(ctx: QueryCtx) {
  const access = await workshopAccess(ctx);
  if (!access.signedIn || !access.allowed)
    throw new ConvexError(errors.workshopOnly);
  return access.email;
}
