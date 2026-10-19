"use client";

import { ConvexAuthProvider } from "@convex-dev/auth/react";
import { ConvexReactClient } from "convex/react";
import type { ReactNode } from "react";
import { env } from "@/env";

const convex = new ConvexReactClient(env.NEXT_PUBLIC_CONVEX_URL);

/**
 * Visitors design without an account: the studio signs them in anonymously
 * when they start their first design, and keeps the session in this browser.
 * Nothing the server renders depends on who is signed in, so every page
 * prerenders and the session is the client's alone.
 */
export function ConvexClientProvider({ children }: { children: ReactNode }) {
  return <ConvexAuthProvider client={convex}>{children}</ConvexAuthProvider>;
}
