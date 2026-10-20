import { Anonymous } from "@convex-dev/auth/providers/Anonymous";
import { convexAuth } from "@convex-dev/auth/server";

/**
 * Couples start designing without an account: the studio signs them in
 * anonymously on their first design, and their work stays theirs on this
 * browser. Accounts that carry designs across devices come with ordering.
 */
export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [Anonymous],
});
