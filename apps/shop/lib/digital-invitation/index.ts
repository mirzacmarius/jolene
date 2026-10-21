import { occasionLabels } from "@jolene/design";
import { digitalInvitation } from "@jolene/products/digital-invitation";

import { shopConfig } from "@/lib/config";

import type { InvitationSummary } from "./types";

// Kept off the checkout like every underscored attribute; Convex unlocks the event it names once the order is paid.
export const EVENT_ATTRIBUTE = digitalInvitation.eventAttribute;

export function isDigitalInvitation(handle: string | null | undefined): boolean {
  return handle === digitalInvitation.handle;
}

// The studio keeps an event's date as YYYY-MM-DD.
export function formatEventDate(date: string): string {
  const day = new Date(`${date}T12:00:00Z`);
  if (Number.isNaN(day.getTime())) return date;
  return new Intl.DateTimeFormat(shopConfig.localization.locale, {
    dateStyle: "long",
    timeZone: "UTC",
  }).format(day);
}

export function describeInvitation(
  invitation: Pick<InvitationSummary, "date" | "hosts" | "occasion">,
): string {
  const date = invitation.date ? formatEventDate(invitation.date) : "";
  return (
    [invitation.hosts.ro, date].filter(Boolean).join(", ") || occasionLabels[invitation.occasion].ro
  );
}

export function getInvitationAttributes(
  eventId: string,
  invitation: InvitationSummary,
): Array<{ key: string; value: string }> {
  return [
    { key: EVENT_ATTRIBUTE, value: eventId },
    { key: "Eveniment", value: describeInvitation(invitation) },
  ];
}

export function getLineEventId(
  attributes: ReadonlyArray<{ key: string; value?: string | null }>,
): string | undefined {
  return attributes.find((attribute) => attribute.key === EVENT_ATTRIBUTE)?.value ?? undefined;
}
