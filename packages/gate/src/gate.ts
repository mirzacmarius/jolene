import { LANGUAGE_COOKIE, resolveLocale } from "@jolene/i18n";
import { GATE_PICTURE, gatePage } from "./page";

/**
 * The cookie a browser keeps once it gave the site's password. It holds a
 * hash keyed by the password, never the password itself, so every browser's
 * stops counting the moment the password changes. The shop and the studio
 * share one address, so one cookie lets a browser into both.
 */
export const GATE_COOKIE = "jolene-gate";

/** How long a browser keeps it: 30 days. */
const DAYS = 30;

/** How long a wrong password waits for its answer, to slow down guessing. */
const WRONG_WAIT = 1000;

/** What the page asking for the password may load: its own style and picture. */
const PAGE_POLICY =
  "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'";

/**
 * The site's password while Jolene isn't public: SITE_PASSWORD, the same on
 * both Vercel projects (docs/adr/0022). Without it, the site is open.
 */
export function sitePassword(): string | null {
  return process.env.SITE_PASSWORD?.trim() || null;
}

const encoder = new TextEncoder();

/** The cookie's value for a password: an HMAC of the cookie's name, keyed by it. */
async function pass(password: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(password),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const mac = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(GATE_COOKIE),
  );
  return Array.from(new Uint8Array(mac), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}

/** Whether two values match, in a time that doesn't tell where they differ. */
function same(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let difference = 0;
  for (let index = 0; index < a.length; index++)
    difference |= a.charCodeAt(index) ^ b.charCodeAt(index);
  return difference === 0;
}

/** The value of a cookie the request carries, or null. */
function cookie(request: Request, name: string): string | null {
  for (const pair of request.headers.get("cookie")?.split(";") ?? []) {
    const [key, ...value] = pair.split("=");
    if (key?.trim() === name) return value.join("=").trim();
  }
  return null;
}

/** robots.txt while the site has a password: no crawler reads any of it. */
function robots(): Response {
  return new Response("User-agent: *\nDisallow: /\n", {
    headers: {
      "Cache-Control": "no-store",
      "Content-Type": "text/plain; charset=utf-8",
    },
  });
}

/**
 * The page asking for the password, in the visitor's language: for no cache
 * to keep and no search engine to index.
 */
function ask(request: Request, wrong: boolean): Response {
  const locale = resolveLocale({
    stored: cookie(request, LANGUAGE_COOKIE),
    acceptLanguage: request.headers.get("accept-language"),
  });
  return new Response(gatePage(locale, wrong), {
    status: 401,
    headers: {
      "Cache-Control": "private, no-store",
      "Content-Language": locale,
      "Content-Security-Policy": PAGE_POLICY,
      "Content-Type": "text/html; charset=utf-8",
      "X-Robots-Tag": "noindex, nofollow",
    },
  });
}

/** Back to the page the visitor asked for, now with the cookie. */
function enter(url: URL, value: string): Response {
  const attributes = [
    `${GATE_COOKIE}=${value}`,
    "Path=/",
    `Max-Age=${DAYS * 24 * 60 * 60}`,
    "HttpOnly",
    "SameSite=Lax",
  ];
  if (url.protocol === "https:") attributes.push("Secure");
  return new Response(null, {
    status: 303,
    headers: {
      "Cache-Control": "no-store",
      Location: url.href,
      "Set-Cookie": attributes.join("; "),
    },
  });
}

/**
 * Keeps the site to the people who know its password, while it has one
 * (docs/adr/0022). Each app's proxy asks it first, for the pages people
 * open: null lets the request through, as it does for a browser that gave
 * the password. Any other gets the page asking for it, which posts the
 * password back to the same address; once it's right, the browser goes on
 * to that page. robots.txt keeps every crawler out meanwhile.
 */
export async function gate(
  request: Request,
  password: string | null = sitePassword(),
): Promise<Response | null> {
  if (!password) return null;
  const url = new URL(request.url);
  if (url.pathname === "/robots.txt") return robots();
  if (url.pathname === GATE_PICTURE) return null;
  const expected = await pass(password);
  const kept = cookie(request, GATE_COOKIE);
  if (kept && same(kept, expected)) return null;
  const form = request.headers
    .get("content-type")
    ?.startsWith("application/x-www-form-urlencoded");
  if (request.method === "POST" && form) {
    const typed = (await request.formData().catch(() => null))?.get("password");
    if (typeof typed === "string") {
      const given = typed.trim();
      if (given && same(await pass(given), expected))
        return enter(url, expected);
      await new Promise((resolve) => setTimeout(resolve, WRONG_WAIT));
      return ask(request, true);
    }
  }
  return ask(request, false);
}
