# A paid order unlocks the digital invitation

A couple can try their digital invitation on the first three families of their list for free. Opening it to everyone is bought as its own product (`invitatie-digitala`, 249 lei for the whole guest list, `packages/products/src/digital-invitation.ts`), unlisted, or comes free with the event's printed invitations.

Jolene sells through its own checkout, which records paid orders in Convex. The mutation that records an order as paid calls `unlockPaid` (`packages/backend/convex/invites/unlock.ts`) in the same transaction, as a subtransaction so an unlock that fails never loses the order, with the order's number and lines: a line of the digital invitation unlocks the event it carries, and a line of at least ten printed invitations from an invitation's proof (docs/adr/0007) unlocks the proof's event, so a sample doesn't. The invitation records which order unlocked it; the same order twice changes nothing. The studio never handles money.

The studio sends the couple to `/products/invitatie-digitala?event=<event id>` once the shop answers for that page (it asks for the product's Markdown page, as for proofs). The product is in the catalog the studio's seed loads, but no list, search or sitemap shows it. Its page reads the event from Convex, as it reads a proof (ADR 0015): the couple's names, the date, the picture of the published card, and whether it's already unlocked. The cart line keeps the event's id, one line of one for each event. Nothing in it travels, so an order of digital invitations alone asks for no address and pays no delivery.

A couple who pays Jolene another way, such as by bank transfer, has the invitation unlocked by Jolene's team by hand: `invites/unlock:byHand` in the Convex dashboard, with the event's id from the couple's email and a note, such as the payment's reference.

## Consequences

- The checkout records paid orders (ADR 0015), so the digital invitation and printed invitations unlock their event as soon as the order is paid.
- The cart refuses the digital invitation without an event, for an event that doesn't exist or one already unlocked, and keeps its line at one; a line whose invitation was unlocked meanwhile can't be paid for.
- Beside at least ten of the event's printed invitations in the same cart, the digital invitation costs nothing, since the order unlocks it with them anyway.
- Anyone with an event's id can read its names, date and picture on the digital invitation's page, as with a proof; the ids can't be guessed.
- A refund doesn't lock the invitation again; Jolene decides that case by case.
