/**
 * Jolene's digital invitation: a couple's invitation sent by link, with its
 * guest list and replies, for one event. It's a product of its own in the
 * store, unlisted: the studio puts it in the cart with the event it's for
 * (the line's `_event` attribute), and Convex unlocks the invitation when
 * Shopify says the order is paid, by this SKU (ADR 0014).
 */
export const digitalInvitation = {
  handle: "invitatie-digitala",
  title: "Invitație digitală",
  sku: "JOLENE-INVITATIE-DIGITALA",
  /** Lei, for the whole guest list. */
  price: 249,
  /** The cart line attribute naming the event, kept off the checkout page. */
  eventAttribute: "_event",
} as const;
