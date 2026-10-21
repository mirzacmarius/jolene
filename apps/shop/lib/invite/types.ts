import type { api } from "@jolene/backend/convex/_generated/api";
import type { FunctionReturnType } from "convex/server";

/** The event whose digital invitation a couple buys: whose it is, its date, the card guests see, and whether it's unlocked. */
export type InviteEvent = NonNullable<FunctionReturnType<typeof api.invites.forShop>>;
