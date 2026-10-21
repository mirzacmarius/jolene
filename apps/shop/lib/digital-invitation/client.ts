"use client";

import { useSearchParams } from "next/navigation";

import { useStudioAnswer } from "@/lib/studio/client";

import type { InvitationSummary } from "./types";

// Undefined while the studio is asked; null for no such event.
export function useInvitation(eventId: string | undefined): InvitationSummary | null | undefined {
  return useStudioAnswer<InvitationSummary>(
    eventId ? `/api/invitations/${encodeURIComponent(eventId)}` : undefined,
  );
}

// The studio sends a couple to the digital invitation's page as ?event=<id>.
export function useEventInvitation(): {
  eventId: string | undefined;
  invitation: InvitationSummary | null | undefined;
} {
  const eventId = useSearchParams().get("event") ?? undefined;
  return { eventId, invitation: useInvitation(eventId) };
}
