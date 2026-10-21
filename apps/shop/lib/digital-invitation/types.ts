import type { Occasion } from "@jolene/design";

// What the studio answers at /studio/api/invitations/<event id> for an event's digital invitation.
export interface InvitationSummary {
  date: string | null;
  hosts: { en: string; ro: string };
  image: string | null;
  occasion: Occasion;
  unlocked: boolean;
}
