import { api } from "@jolene/backend/convex/_generated/api";
import { fetchQuery } from "convex/nextjs";

import type { Order } from "@/lib/order/types";

// Never cached: an order is the couple's, seen only through its link.
export async function getOrder(token: string): Promise<Order | null> {
  return fetchQuery(api.orders.byToken, { token });
}
