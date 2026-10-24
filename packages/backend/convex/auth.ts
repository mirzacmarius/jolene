import Google, { type GoogleProfile } from "@auth/core/providers/google";
import { Anonymous } from "@convex-dev/auth/providers/Anonymous";
import { Email } from "@convex-dev/auth/providers/Email";
import { convexAuth } from "@convex-dev/auth/server";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { type ActionCtx, env, type MutationCtx } from "./_generated/server";
import { CODE_MINUTES, claimAnonymousWork } from "./accounts";
import { shopUrl } from "./orders/links";
import { onWorkshopList } from "./workshop/staff";

/** `count` random digits, as a phone's keypad types them. */
function digits(count: number) {
  return Array.from(crypto.getRandomValues(new Uint32Array(count)), (value) =>
    String(value % 10),
  ).join("");
}

/**
 * The account a Google sign-in opens, for the workshop's team only
 * (docs/adr/0030): Google must have verified the address, and it must be on
 * the workshop's list. Anyone else comes back to the studio signed out. The
 * account keeps the address and nothing else of Google's, so a team member
 * who signed in with a code before finds the same account.
 */
export function workshopGoogleProfile(profile: GoogleProfile) {
  const email = (profile.email ?? "").trim().toLowerCase();
  if (profile.email_verified !== true)
    throw new Error("Google hasn't verified this account's address");
  if (!onWorkshopList(email))
    throw new Error("Google signs in only the workshop's addresses");
  return { id: profile.sub, email, emailVerified: true };
}

/**
 * Where a sign-in may send the visitor back to: a page of the studio, at
 * SITE_URL or at /studio on the shop's address, where production serves it
 * (docs/adr/0004). A path is SITE_URL's. Anywhere else could take the
 * sign-in's code, so it's refused.
 */
export function studioPage(redirectTo: string): string {
  const site = env.SITE_URL?.trim().replace(/\/$/, "");
  if (redirectTo.startsWith("/") || redirectTo.startsWith("?")) {
    if (!site) throw new Error("SITE_URL isn't set");
    return `${site}${redirectTo}`;
  }
  let page: URL;
  try {
    page = new URL(redirectTo);
  } catch {
    throw new Error(`A sign-in can't come back to ${redirectTo}`);
  }
  const shop = shopUrl();
  for (const address of [site, shop && `${shop}/studio`]) {
    if (!address) continue;
    const studio = new URL(address);
    const path = studio.pathname.replace(/\/$/, "");
    if (
      page.origin === studio.origin &&
      (page.pathname === path || page.pathname.startsWith(`${path}/`))
    )
      return page.href;
  }
  throw new Error(`A sign-in can't come back to ${redirectTo}`);
}

/**
 * Couples start designing without an account: the studio signs them in
 * anonymously on their first design, and their work stays theirs on this
 * browser. To keep it beyond the browser, for a guest list or to share an
 * event with a partner, they sign in with a code sent to their email, and
 * what they made anonymously moves to the account (accounts.ts). The
 * workshop's team may sign in with Google instead.
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
    // Its client is AUTH_GOOGLE_ID and AUTH_GOOGLE_SECRET. It asks Google for
    // the address alone, and which of the browser's Google accounts to use.
    Google({
      authorization: {
        params: { scope: "openid email", prompt: "select_account" },
      },
      profile: workshopGoogleProfile,
    }),
  ],
  callbacks: {
    async redirect({ redirectTo }) {
      return studioPage(redirectTo);
    },
    async beforeSessionCreation(ctx, { userId }) {
      await claimAnonymousWork(
        ctx as unknown as MutationCtx,
        userId as Id<"users">,
      );
    },
  },
});
