"use client";

import { ConvexAuthProvider, useAuthToken } from "@convex-dev/auth/react";
import { ConvexReactClient } from "convex/react";
import {
  type ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { SignInReturnProvider } from "@/components/account/sign-in-return";
import { env } from "@/env";

const convex = new ConvexReactClient(env.NEXT_PUBLIC_CONVEX_URL);

/** The session a Convex Auth token is for, as "user|session". */
function sessionOf(token: string | null): string | null {
  const payload = token?.split(".")[1];
  if (!payload) return null;
  try {
    const claims = JSON.parse(
      atob(payload.replaceAll("-", "+").replaceAll("_", "/")),
    ) as { sub?: unknown };
    return typeof claims.sub === "string" ? claims.sub : null;
  } catch {
    return null;
  }
}

/**
 * Notices a visitor going from one session straight to another, as an
 * anonymous visitor does who signs in with their email, here or in another
 * tab. Convex's provider only re-authenticates when someone signs in or out,
 * so its queries would go on answering for the anonymous visitor.
 */
function SessionSwitch({ onSwitch }: { onSwitch: () => void }) {
  const session = sessionOf(useAuthToken());
  const previous = useRef(session);
  useEffect(() => {
    if (previous.current && session && previous.current !== session) onSwitch();
    previous.current = session;
  }, [session, onSwitch]);
  return null;
}

/**
 * Visitors design without an account: the studio signs them in anonymously
 * when they start their first design, and keeps the session in this browser.
 * Nothing the server renders depends on who is signed in, so every page
 * prerenders and the session is the client's alone. When the session
 * changes under it, the provider starts again with the new one. A sign-in
 * that comes back with a code in the address waits for that session
 * (SignInReturnProvider), rather than the provider trading the code first.
 */
export function ConvexClientProvider({ children }: { children: ReactNode }) {
  const [start, setStart] = useState(0);
  const restart = useCallback(() => setStart((count) => count + 1), []);
  return (
    <ConvexAuthProvider key={start} client={convex} shouldHandleCode={false}>
      <SessionSwitch onSwitch={restart} />
      <SignInReturnProvider>{children}</SignInReturnProvider>
    </ConvexAuthProvider>
  );
}
