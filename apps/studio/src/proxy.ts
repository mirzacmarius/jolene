import { isLocale, LANGUAGE_COOKIE, resolveLocale } from "@jolene/i18n";
import { type NextRequest, NextResponse } from "next/server";

/**
 * Serves each page in the visitor's language: the one they chose (in the shop
 * or here), else their browser's, else Romanian. The address stays as typed;
 * the language is a rewrite to /studio/[locale], so each language's pages are
 * prerendered once.
 */
export function proxy(request: NextRequest) {
  const url = request.nextUrl.clone();
  const [, , first] = url.pathname.split("/");
  if (isLocale(first)) return NextResponse.next();
  const locale = resolveLocale({
    stored: request.cookies.get(LANGUAGE_COOKIE)?.value,
    acceptLanguage: request.headers.get("accept-language"),
  });
  url.pathname = url.pathname.replace(/^\/studio/, `/studio/${locale}`);
  return NextResponse.rewrite(url);
}

export const config = {
  // The studio's pages, but not its files, which have an extension (the icon),
  // nor what it answers the shop with, under /studio/api.
  matcher: ["/studio", "/studio/((?!api/|.*\\.).*)"],
};
