import Google from "@auth/core/providers/google";
import { Anonymous } from "@convex-dev/auth/providers/Anonymous";
import { convexAuth } from "@convex-dev/auth/server";

/**
 * Couples start designing without an account: the studio signs them in
 * anonymously on their first design, and their work stays theirs on this
 * browser. The workshop signs in with Google (AUTH_GOOGLE_ID and
 * AUTH_GOOGLE_SECRET), and its order list opens to the addresses in
 * WORKSHOP_EMAILS (workshop/staff.ts).
 */
export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [
    Anonymous,
    Google({
      // An address counts as verified only when Google says it checked it,
      // as the workshop's list goes by verified addresses.
      profile: (profile) => ({
        id: profile.sub,
        name: profile.name,
        email: profile.email,
        image: profile.picture,
        emailVerified: profile.email_verified === true,
      }),
    }),
  ],
});
