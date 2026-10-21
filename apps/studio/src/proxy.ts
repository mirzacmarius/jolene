import { isLocale, LANGUAGE_COOKIE, resolveLocale } from "@jolene/i18n";
import { type NextRequest, NextResponse } from "next/server";

/** The address guests open invitations at: invitatie.jolene.ro. */
const GUEST_HOST = /^invitatie\./;

/** An invitation's address and a family's code, as guests' links carry them. */
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const CODE = /^[a-z0-9]+$/;

/**
 * On the guests' address, an invitation's paths are the studio's
 * /invitatie/…: /ana-si-mihai/abc23def is /invitatie/ana-si-mihai/abc23def.
 * Anything else there (the page's scripts, its icon) passes as it is.
 */
function guestPath(pathname: string) {
  const [slug, rest, ...more] = pathname.slice(1).split("/");
  if (more.length > 0 || !slug || !SLUG.test(slug)) return null;
  if (rest !== undefined && !CODE.test(rest) && rest !== "calendar.ics")
    return null;
  return `/invitatie${pathname}`;
}

/**
 * Serves each page in the visitor's language: the one they chose (in the shop
 * or here), else their browser's, else Romanian. The address stays as typed;
 * the language is a rewrite to /studio/[locale], so each language's pages are
 * prerendered once. Invitations on the guests' address are rewritten to
 * /invitatie, where they show in the invitation's language.
 */
export function proxy(request: NextRequest) {
  const url = request.nextUrl.clone();
  if (GUEST_HOST.test(url.hostname)) {
    const path = guestPath(url.pathname);
    if (!path) return NextResponse.next();
    url.pathname = path;
    return NextResponse.rewrite(url);
  }
  const [, area, first] = url.pathname.split("/");
  if (area !== "studio" || isLocale(first)) return NextResponse.next();
  const locale = resolveLocale({
    stored: request.cookies.get(LANGUAGE_COOKIE)?.value,
    acceptLanguage: request.headers.get("accept-language"),
  });
  url.pathname = url.pathname.replace(/^\/studio/, `/studio/${locale}`);
  return NextResponse.rewrite(url);
}

export const config = {
  matcher: [
    // The studio's pages, but not its files, which have an extension (the
    // icon), nor what it answers the shop with, under /studio/api.
    "/studio",
    "/studio/((?!api/|.*\\.).*)",
    // An invitation and a family's code on the guests' address.
    "/:slug",
    "/:slug/:code",
  ],
};
