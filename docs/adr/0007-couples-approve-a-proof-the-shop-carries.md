# Couples approve a proof, and the shop carries it to the order

A couple orders from their design's proof, at `/studio/design/<id>/bun-de-tipar`: every face of the design, flat, with their own details and nothing filled in for them, beside what to look at before it prints. The studio finds that with the checks the print file runs (`checkDesign` in `packages/design`, which `packages/print` uses too), measuring the words with the browser's own fonts once they have loaded: lines past the safe margin or too long for their box, details left empty, letters no face has, photos not given or under 300 dpi.

Approving keeps the proof in Convex (`proofs`): the design document and all of the event's details as the couple saw them, with the design's revision. A design or details changed while the couple looked aren't approved; approving the same design and details again gives the same proof. The studio then draws the proof's picture, as the suite lies together, and sends its bytes to an action that stores it, so every proof's picture was stored by the server and no stored file can be attached or deleted by naming it.

A proof is sold as its template's Shopify product (`templates.shopifyProductHandle`), read whenever it is asked for, so an approved proof becomes orderable once the shop sells its item. The studio offers the order only when the shop does: it asks for the product's Markdown page, `/products/<handle>.md`, which the shop answers for every product it sells, so the studio needs no Shopify credentials. Otherwise the couple writes to Jolene with the proof's code.

The order goes to `/products/<handle>?proof=<id>`. The shop asks the studio what the proof is, at `/studio/api/proofs/<id>`, and when it is a proof of that product:

- the page shows the couple's design, with a link back to change it;
- the line goes to the cart with two attributes: `_proof`, the proof's id, which Shopify keeps off the checkout but shows on the order in the admin and sends with its webhooks, and `Bun de tipar`, the day the couple approved it, which the cart and the checkout show;
- Shop Pay's buy-now button isn't offered, since it skips the cart and the attributes with it.

The cart shows a line's proof picture in place of the product's photo.

## Consequences

- The workshop finds a line's design by its `_proof` attribute, and prints the proof, not the design as it is now.
- A design changed after its proof was approved needs a new proof, and orders as a line of its own; the old line stays in the cart until the couple removes it.
- A line added any other way (straight from a product page, quick shop, Shop Pay) carries no design.
- The studio relies on the shop's Markdown product pages, which come with the Vercel Shop template. If they go, the studio needs another way to know what the shop sells.
- The shop keeps its answer for every product it is asked about, a missing one too, for up to 30 days, until Shopify's product webhooks reach `/api/webhooks/shopify`, signed with `SHOPIFY_WEBHOOK_SECRET`. The studio asks about items before the shop sells them, so the store's webhooks must be set up before items go on sale, or those items stay unsold on both sides.
- Anyone with a proof's id can read its summary and see its picture, as with an unlisted link; the ids can't be guessed.
