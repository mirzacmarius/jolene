import { api } from "@jolene/backend/convex/_generated/api";
import { fetchQuery } from "convex/nextjs";
import { connection } from "next/server";

import type { Order } from "@/lib/order/types";

// Never cached: an order is the couple's, seen only through its link.
export async function getOrder(token: string): Promise<Order | null> {
  await connection();
  return fetchQuery(api.orders.byToken, { token });
}
