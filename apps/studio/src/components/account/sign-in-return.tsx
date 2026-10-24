"use client";

import { useAuthActions } from "@convex-dev/auth/react";
import { useConvexAuth } from "convex/react";
import {
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";

/**
 * What a sign-in through Google adds to the address it comes back to, beside
 * the code Convex Auth adds once Google signed the visitor in.
 */
export const SIGN_IN_RETURN = "signin";

/**
 * How a sign-in that came back to this page went: there was none, its code
 * is being traded for the account's session, or it came back without one,
 * as when the workshop's list doesn't have the Google account's address.
 */
export type SignInReturn = "none" | "signing-in" | "refused";

const Return = createContext<SignInReturn>("none");

/** How a sign-in that came back to this page went. */
export function useSignInReturn() {
  return useContext(Return);
}

/**
 * The lock Convex Auth's provider holds, across the browser's tabs, while it
 * refreshes the session's token (`browserMutex` in @convex-dev/auth's
 * react/client.tsx).
 */
const REFRESH_LOCK = "__convexAuthRefreshToken";

/**
 * Runs `trade` once no refresh of the session's token is under way. The
 * provider refreshes the anonymous session's token as soon as the server
 * takes it, and a code traded meanwhile ends that session: the refresh
 * would come back empty and sign the visitor out of the new account.
 */
async function betweenRefreshes<T>(trade: () => Promise<T>): Promise<T> {
  const locks = typeof navigator === "undefined" ? undefined : navigator.locks;
  return locks ? await locks.request(REFRESH_LOCK, trade) : await trade();
}

/**
 * Finishes a sign-in that comes back to the page with a code in its address,
 * as one through Google does. It waits for the browser's own session, the
 * anonymous one a visitor designs in, and trades the code under it, so that
 * what they made moves to the account as it does when they type an emailed
 * code (docs/adr/0011).
 */
export function SignInReturnProvider({ children }: { children: ReactNode }) {
  const { isLoading } = useConvexAuth();
  const { signIn } = useAuthActions();
  const [state, setState] = useState<SignInReturn>("none");
  const done = useRef(false);
  useEffect(() => {
    if (done.current) return;
    const url = new URL(window.location.href);
    const code = url.searchParams.get("code");
    if (!code && !url.searchParams.has(SIGN_IN_RETURN)) return;
    if (code) setState("signing-in");
    if (isLoading) return;
    done.current = true;
    url.searchParams.delete("code");
    url.searchParams.delete(SIGN_IN_RETURN);
    window.history.replaceState(null, "", url);
    if (!code) {
      setState("refused");
      return;
    }
    // Only Google's sign-in comes back to a page; its code alone signs in.
    betweenRefreshes(() => signIn("google", { code })).then(
      ({ signingIn }) => setState(signingIn ? "none" : "refused"),
      () => setState("refused"),
    );
  }, [isLoading, signIn]);
  return <Return.Provider value={state}>{children}</Return.Provider>;
}
