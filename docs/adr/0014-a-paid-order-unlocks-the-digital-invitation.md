# A paid Shopify order unlocks the digital invitation

A couple can try their digital invitation on the first three families of their list for free. Opening it to everyone is bought in the shop, as its own product (`invitatie-digitala`, SKU `JOLENE-INVITATIE-DIGITALA`, 249 lei for the whole guest list, `packages/products/src/digital-invitation.ts`), or comes free with the event's printed invitations. Shopify keeps the price, the cart and the payment (docs/adr/0001); the studio never handles money.

The studio sends the couple to `/products/invitatie-digitala?event=<event id>`, once the shop sells the product (it asks for the product's Markdown page, as for proofs, docs/adr/0007); until then the couple writes to Jolene. The shop asks the studio what the event is, at `/studio/api/invitations/<event id>`, shows the invitation with the couple's names and date, and puts it in the cart with two attributes: `_event`, the event's id, kept off the checkout, and `Eveniment`, the names and date the cart and checkout show. The button is off when the invitation is already unlocked or already in the cart, the cart keeps the line at one, and Shop Pay's buy-now isn't offered, since it skips the cart and the attributes with it.

Shopify's `orders/paid` webhook goes to Convex (`<deployment>.convex.site/shopify/orders-paid`), signed with `SHOPIFY_WEBHOOK_SECRET`; anything not signed by the store is refused. A paid line of the digital invitation's SKU unlocks the event its `_event` names, and a paid line of at least ten printed invitations from a proof (`_proof`) unlocks the proof's event, so a sample doesn't. The invitation records which order unlocked it; the same order twice changes nothing.

## Consequences

- The store needs the `orders/paid` webhook, in JSON, to the production Convex site, and its signing secret on Convex as `SHOPIFY_WEBHOOK_SECRET`. Until then paid orders unlock nothing, and Jolene can unlock an invitation from the Convex dashboard by running `orders:paid` with the order's number and line.
- The Products workflow puts the product in the store, unlisted: reached from the studio, never from the catalog.
- Anyone with an event's id can read its names, date and picture from `/studio/api/invitations/<id>`, as with a proof; the ids can't be guessed.
- A refund doesn't lock the invitation again; Jolene decides that case by case.
