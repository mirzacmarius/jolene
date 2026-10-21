/**
 * Jolene's digital invitation: a couple's invitation sent by link, with its
 * guest list and replies, for one event. It's a product of its own, unlisted:
 * the studio sends the couple to its page with the event it's for, the cart
 * line carries the event, and a paid order unlocks that event's invitation
 * (ADR 0014).
 */
export const digitalInvitation = {
  handle: "invitatie-digitala",
  title: "Invitație digitală",
  sku: "JOLENE-INVITATIE-DIGITALA",
  /** Lei, for the whole guest list. */
  price: 249,
} as const;
