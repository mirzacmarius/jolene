import type { api } from "@jolene/backend/convex/_generated/api";
import type { FunctionReturnType } from "convex/server";

// The order's shape is Convex's (convex/orders.ts): what was paid for, as it was priced.
export type Order = NonNullable<FunctionReturnType<typeof api.orders.byToken>>;

export type OrderLine = Order["lines"][number];
