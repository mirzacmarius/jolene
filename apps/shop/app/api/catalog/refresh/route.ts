import { revalidateTag } from "next/cache";

import { isWorkshopAccount } from "@/lib/workshop/server";

export async function POST(request: Request): Promise<Response> {
  const token = /^Bearer (.+)$/.exec(request.headers.get("authorization") ?? "")?.[1];
  if (!token || !(await isWorkshopAccount(token))) return new Response(null, { status: 403 });
  // Expired rather than stale: the team looks at the shop right after saving.
  revalidateTag("products", { expire: 0 });
  revalidateTag("categories", { expire: 0 });
  return new Response(null, { status: 204 });
}
