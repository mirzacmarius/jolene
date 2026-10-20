import { getAuthUserId } from "@convex-dev/auth/server";
import { ConvexError, v } from "convex/values";
import { env, internalQuery, type QueryCtx } from "../_generated/server";
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
 * Who the workshop sees signed in: no one, as for a couple designing
 * anonymously, or a Google account and whether it's one of the workshop's.
 */
export async function workshopAccess(ctx: QueryCtx) {
  const userId = await getAuthUserId(ctx);
  const user = userId ? await ctx.db.get("users", userId) : null;
  if (!user?.email)
    return {
      signedIn: false as const,
      // Google can't sign anyone in until the deployment has its client.
      googleConfigured: Boolean(
        env.AUTH_GOOGLE_ID?.trim() && env.AUTH_GOOGLE_SECRET?.trim(),
      ),
      // Google's answer comes back to SITE_URL (auth.ts), and only the
      // browser that set off from there can take it.
      signInAt: env.SITE_URL?.trim()
        ? `${env.SITE_URL.trim().replace(/\/+$/, "")}/atelier`
        : null,
    };
  return {
    signedIn: true as const,
    email: user.email,
    // Only an address Google checked (auth.ts) counts, if the list has it.
    allowed:
      user.emailVerificationTime !== undefined &&
      workshopEmails().has(user.email.toLowerCase()),
  };
}

/** Throws unless one of the workshop's accounts is signed in. */
export async function requireWorkshop(ctx: QueryCtx) {
  const access = await workshopAccess(ctx);
  if (!access.signedIn || !access.allowed)
    throw new ConvexError(errors.workshopOnly);
}

/** Throws unless one of the workshop's accounts is signed in. */
export const check = internalQuery({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    await requireWorkshop(ctx);
    return null;
  },
});
