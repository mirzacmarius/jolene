# A paid order unlocks the digital invitation

A couple can try their digital invitation on the first three families of their list for free. Opening it to everyone is bought as its own product (`invitatie-digitala`, 249 lei for the whole guest list, `packages/products/src/digital-invitation.ts`), unlisted, or comes free with the event's printed invitations.

Jolene sells through its own checkout, which records paid orders in Convex. The mutation that records an order as paid calls `unlockPaid` (`packages/backend/convex/invites/unlock.ts`) in the same transaction, with the order's number and lines: a line of the digital invitation unlocks the event it carries, and a line of at least ten printed invitations from an invitation's proof (docs/adr/0007) unlocks the proof's event, so a sample doesn't. The invitation records which order unlocked it; the same order twice changes nothing. The studio never handles money.

The studio sends the couple to `/products/invitatie-digitala?event=<event id>` once the shop answers for that page (it asks for the product's Markdown page, as for proofs). The shop can ask the studio what the event is, at `/studio/api/invitations/<event id>`: the couple's names, the date, the picture of the published card, and whether it's already unlocked. The page puts the event on the cart line and sells one per event.

Until the shop sells it, the couple writes to Jolene, and Jolene's team unlocks the invitation by hand: `invites/unlock:byHand` in the Convex dashboard, with the event's id from the couple's email and a note, such as the payment's reference.

## Consequences

- Until the checkout records paid orders, every unlock is by hand.
- The product page refuses an event that doesn't exist or is already unlocked, and keeps the line at one; a line without an event unlocks nothing.
- Anyone with an event's id can read its names, date and picture from `/studio/api/invitations/<id>`, as with a proof; the ids can't be guessed.
- A refund doesn't lock the invitation again; Jolene decides that case by case.
