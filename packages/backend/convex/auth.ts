import Google from "@auth/core/providers/google";
import { Anonymous } from "@convex-dev/auth/providers/Anonymous";
import { Email } from "@convex-dev/auth/providers/Email";
import { convexAuth } from "@convex-dev/auth/server";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import type { ActionCtx, MutationCtx } from "./_generated/server";
import { CODE_MINUTES, claimAnonymousWork } from "./accounts";
import { signInReturn } from "./workshop/google";

/** `count` random digits, as a phone's keypad types them. */
function digits(count: number) {
  return Array.from(crypto.getRandomValues(new Uint32Array(count)), (value) =>
    String(value % 10),
  ).join("");
}

/**
 * Couples start designing without an account: the studio signs them in
 * anonymously on their first design, and their work stays theirs on this
 * browser. To keep it beyond the browser, for a guest list or to share an
 * event with a partner, they sign in with a code sent to their email, and
 * what they made anonymously moves to the account (accounts.ts). Jolene's
 * team signs in to the workshop with Google once the deployment has its
 * client (workshop/google.ts).
 */
export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [
    Anonymous,
    // Eight digits: Convex Auth checks a code with the address it was sent
    // to, and allows ten wrong guesses an hour for each address.
    Email({
      id: "email",
      maxAge: CODE_MINUTES * 60,
      generateVerificationToken: async () => digits(8),
      async sendVerificationRequest(
        { identifier, token }: { identifier: string; token: string },
        // Convex Auth passes its action's context, though Auth.js's type
        // has no room for it.
        ctx?: ActionCtx,
      ) {
        if (!ctx) throw new Error("Sending a code needs Convex Auth's context");
        await ctx.runMutation(internal.accounts.sendCode, {
          email: identifier,
          code: token,
        });
      },
    }),
    // Its client is AUTH_GOOGLE_ID and AUTH_GOOGLE_SECRET. An address counts
    // as verified only when Google says it checked it, as the workshop's
    // list goes by verified addresses.
    Google({
      profile: (profile) => ({
        id: profile.sub,
        name: profile.name,
        email: profile.email,
        image: profile.picture,
        emailVerified: profile.email_verified === true,
      }),
    }),
  ],
  callbacks: {
    // Google brings the team back to the page it set off from.
    redirect: async ({ redirectTo }) => signInReturn(redirectTo),
    async beforeSessionCreation(ctx, { userId }) {
      await claimAnonymousWork(
        ctx as unknown as MutationCtx,
        userId as Id<"users">,
      );
    },
  },
});
