import { NextResponse, type NextRequest } from "next/server";

import { isPostRoutePath } from "@/lib/blog";
import { getRefinedCategoryPath, isRefinedCategoryPath } from "@/lib/categories";
import { getMarkdownRewritePath } from "@/lib/markdown/representation";

export function proxy(request: NextRequest): Response {
  const { pathname, search } = request.nextUrl;
  if (isRefinedCategoryPath(pathname) || isPostRoutePath(pathname))
    return new Response("Not Found", { status: 404 });
  const rewritePath = getMarkdownRewritePath(request) ?? getRefinedCategoryPath(pathname, search);
  return rewritePath
    ? NextResponse.rewrite(new URL(`${rewritePath}${search}`, request.url))
    : NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|_next/data|_vercel|favicon.ico).*)"],
};
