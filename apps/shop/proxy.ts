import { gate } from "@jolene/gate";
import { NextResponse, type NextRequest } from "next/server";

import { isPostRoutePath } from "@/lib/blog";
import { getRefinedCategoryPath, isRefinedCategoryPath } from "@/lib/categories";
import { getMarkdownRewritePath } from "@/lib/markdown/representation";

export async function proxy(request: NextRequest): Promise<Response> {
  const gated = await gate(request);
  if (gated) return gated;
  const { pathname, search } = request.nextUrl;
  if (isRefinedCategoryPath(pathname) || isPostRoutePath(pathname))
    return new Response("Not Found", { status: 404 });
  const rewritePath = getMarkdownRewritePath(request) ?? getRefinedCategoryPath(pathname, search);
  return rewritePath
    ? NextResponse.rewrite(new URL(`${rewritePath}${search}`, request.url))
    : NextResponse.next();
}

export const config = {
  // `/api` answers the studio's calls, which check their callers themselves, so the site's password never stands before it.
  matcher: ["/((?!_next/static|_next/image|_next/data|_vercel|favicon.ico|api/|.well-known/).*)"],
};
