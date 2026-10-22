import { getAuthUserId } from "@convex-dev/auth/server";
import { ConvexError } from "convex/values";
import type { Id } from "../_generated/dataModel";
import { env, type QueryCtx } from "../_generated/server";
import { errors } from "../utils/errors";
import { googleOrigins, googleSignIn } from "./google";

/** The addresses in WORKSHOP_EMAILS, in lower case. */
function workshopEmails() {
  return new Set(
    (env.WORKSHOP_EMAILS ?? "")
      .split(",")
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean),
  );
}

/** Whether `email` is one of the addresses the workshop opens to. */
export function isWorkshopAddress(email: string): boolean {
  return workshopEmails().has(email.trim().toLowerCase());
}

/**
 * Whether Google vouches for the account's address: the account signed in
 * with a Google account whose address, as Google verified it, is this one.
 */
async function googleVouches(
  ctx: QueryCtx,
  userId: Id<"users">,
  email: string,
) {
  const accounts = await ctx.db
    .query("authAccounts")
    .withIndex("userIdAndProvider", (q) =>
      q.eq("userId", userId).eq("provider", "google"),
    )
    .take(10);
  return accounts.some(
    (account) => account.emailVerified?.toLowerCase() === email.toLowerCase(),
  );
}

/**
 * Who the workshop sees signed in: no one with an account, as for a couple
 * designing without one, or an account and whether it's one of the
 * workshop's. A code sent to the address (auth.ts) proves it's theirs until
 * the deployment has Google's client; then Google must vouch for it, and the
 * workshop's addresses get no codes (accounts.sendCode).
 */
export async function workshopAccess(ctx: QueryCtx) {
  const google = googleSignIn() ? { origins: googleOrigins() } : null;
  const userId = await getAuthUserId(ctx);
  const user = userId ? await ctx.db.get("users", userId) : null;
  if (!userId || !user?.email) return { signedIn: false as const, google };
  const listed =
    user.emailVerificationTime !== undefined && isWorkshopAddress(user.email);
  return {
    signedIn: true as const,
    email: user.email,
    listed,
    allowed:
      listed &&
      (google === null || (await googleVouches(ctx, userId, user.email))),
    google,
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
