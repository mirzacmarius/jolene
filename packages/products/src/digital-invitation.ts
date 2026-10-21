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
  /** What its page in the shop says of it, under the couple's invitation. */
  descriptionHtml: [
    "<p>Invitația voastră, trimisă prin link: fiecare familie o deschide pe telefon, vede programul zilei și vă confirmă dacă vine, cu meniul ales de fiecare invitat.</p>",
    "<p>Prețul e pentru toată lista de invitați, oricâte familii ar avea. Înainte s-o cumpărați, o puteți încerca gratuit cu primele trei familii.</p>",
    "<p>Vine gratuit cu invitațiile tipărite comandate din designul ei.</p>",
  ].join(""),
} as const;
