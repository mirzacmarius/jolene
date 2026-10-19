import { isLocale, LANGUAGE_COOKIE, resolveLocale } from "@jolene/i18n";
import { type NextRequest, NextResponse } from "next/server";

/**
 * Serves each page in the visitor's language: the one they chose (in the shop
 * or here), else their browser's, else Romanian. The address stays as typed;
 * the language is a rewrite to [locale], so each language's pages are
 * prerendered once.
 */
export function proxy(request: NextRequest) {
  const url = request.nextUrl.clone();
  const [, first] = url.pathname.split("/");
  if (isLocale(first)) return NextResponse.next();
  const locale = resolveLocale({
    stored: request.cookies.get(LANGUAGE_COOKIE)?.value,
    acceptLanguage: request.headers.get("accept-language"),
  });
  url.pathname = `/${locale}${url.pathname === "/" ? "" : url.pathname}`;
  return NextResponse.rewrite(url);
}

export const config = {
  // Everything but Next's own files and files with an extension (icons, the
  // manifest). Paths here are under the base path, /studio.
  matcher: ["/((?!_next/static|_next/image|.*\\..*).*)", "/"],
};
