# The workshop reads its orders from Shopify each time it looks

Shopify keeps the orders (docs/adr/0001). Its admin shows a designed line as attributes: a proof's id, the answers to the line's order options, an extras line beside it. The workshop needs each line's proof as a picture, what the customer chose, and whether the order adds up, since the shop picks the extras line's variant (docs/adr/0008): a crafted cart can pay less than its choices cost, leave out a fee or order fewer than the minimum.

So the studio has a page for the workshop, `/studio/atelier`, and Convex reads the store's open orders for it whenever it opens or is refreshed:

- **Nothing is copied.** An action reads the open orders, oldest first, with the Admin API (`orders`, `orderLines` and `orderNodes` in `packages/products`), then the products, fees and order options their lines name. It checks each line against what its choices cost today and finds its proof in Convex. Shopify stays the only record of an order, so the list is never behind the admin, and an order leaves it once it's marked shipped there. Shopify's order webhooks feeding a Convex table were the alternative: a signing secret, retries, and a copy to keep in step with every edit, refund and fulfilment.
- **The same app as the catalog.** The deployment trades the Dev Dashboard app's client ID and secret for a day's token on each read, with the app's `read_orders` scope (`SHOPIFY_STORE_DOMAIN`, `SHOPIFY_CLIENT_ID` and `SHOPIFY_CLIENT_SECRET` in Convex's environment). The list asks for no customer's name, address, email or phone.
- **Google accounts on a list.** Couples stay anonymous. The workshop signs in with Google through Convex Auth (`AUTH_GOOGLE_ID` and `AUTH_GOOGLE_SECRET`), and the list opens to the addresses in `WORKSHOP_EMAILS` that Google says it verified.
- **What it checks**: that Shopify has the payment, the minimum order, required answers, answers that are no longer among their option's choices, the extras paid against the choices' prices today, extras without their product's line, fees chosen but not on the order, products gone from the store, and proofs the studio doesn't have.

## Consequences

- Each read takes a token and a few Admin API calls, a couple of seconds in all. It reads up to 40 open orders; the page links to the admin for the rest.
- The checks use today's prices, so a price Jolene changed after an order shows as a difference to look into, not always a crafted cart.
- Google sends its answer back to the studio at `SITE_URL`, and only the browser that set off from there can take it, so the workshop signs in at that address; the page elsewhere links there. Production's is the studio's Vercel address until it changes.
- Google calls back to one Convex deployment, the one whose `/api/auth/callback/google` its OAuth client lists, so previews can't sign the workshop in.
- Signing in with Google in a browser where a couple designed anonymously leaves those designs with the anonymous account.
- An order's line shows the proof the couple approved (docs/adr/0007), which is what the workshop prints from; its print file comes next.
