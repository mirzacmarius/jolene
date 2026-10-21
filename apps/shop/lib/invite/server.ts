import { api } from "@jolene/backend/convex/_generated/api";
import { fetchQuery } from "convex/nextjs";
import { connection } from "next/server";

import type { InviteEvent } from "./types";

// The studio sends a couple to the digital invitation's page as ?event=<id>.
export async function getInviteEvent(id: string | undefined): Promise<InviteEvent | null> {
  if (!id) return null;
  await connection();
  return fetchQuery(api.invites.forShop, { eventId: id });
}
