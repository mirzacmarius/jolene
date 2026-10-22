import { env } from "../_generated/server";
import { shopUrl } from "../orders/links";

/**
 * Jolene's team signs in to the workshop with Google once the deployment has
 * its OAuth client (docs/adr/0021), and with a code sent to the address until
 * then, as previews and local deployments always do.
 */
export function googleSignIn(): boolean {
  return Boolean(env.AUTH_GOOGLE_ID?.trim() && env.AUTH_GOOGLE_SECRET?.trim());
}

/** `url` as a URL, or null for text that isn't one. */
function parse(url: string): URL | null {
  try {
    return new URL(url.trim());
  } catch {
    return null;
  }
}

/**
 * The addresses Google can bring the team back to, the shop's first: the
 * studio is served at /studio on the shop's address and on its own, SITE_URL.
 * Only the browser that set off for Google can take its answer, so the team
 * signs in from one of these.
 */
export function googleOrigins(): string[] {
  const site = env.SITE_URL ? parse(env.SITE_URL) : null;
  const origins = [shopUrl(), site?.origin ?? null].filter(
    (origin) => origin !== null,
  );
  return [...new Set(origins)];
}

/**
 * Where Convex Auth sends the browser back after Google (auth.ts): a path on
 * SITE_URL, as Convex Auth allows by default, or a studio page on one of
 * googleOrigins(), so the team comes back to the page and the address it set
 * off from. Anything else is refused.
 */
export function signInReturn(redirectTo: string): string {
  const site = env.SITE_URL?.trim().replace(/\/+$/, "");
  if (!site) throw new Error("SITE_URL isn't set");
  if (redirectTo.startsWith("/") || redirectTo.startsWith("?"))
    return `${site}${redirectTo}`;
  const url = parse(redirectTo);
  if (
    url &&
    googleOrigins().includes(url.origin) &&
    /^\/studio(\/|$)/.test(url.pathname)
  )
    return url.href;
  throw new Error(`Invalid redirectTo ${redirectTo}`);
}
