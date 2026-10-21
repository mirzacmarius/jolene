import type { api } from "@jolene/backend/convex/_generated/api";
import type { Language } from "@jolene/design";
import type { FunctionReturnType } from "convex/server";

/** The couple's page of an event's digital invitation, once it's theirs. */
export type Dashboard = Extract<
  FunctionReturnType<typeof api.invites.dashboard>,
  { kind: "ready" }
>;

/** The digital invitation, once the couple has made it. */
export type Invite = NonNullable<Dashboard["invite"]>;

export type Previews = NonNullable<
  FunctionReturnType<typeof api.invites.previews>
>;

/** The message a family's link goes with, in each language guests read. */
export type ShareTexts = Record<
  Language,
  { wedding: string; christening: string; general: string }
>;
