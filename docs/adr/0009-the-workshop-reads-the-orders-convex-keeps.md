# The workshop reads the orders Convex keeps, for the team's accounts

Orders are Convex's since Jolene sells through its own checkout (docs/adr/0015): each paid Checkout Session becomes an order with its lines as they were priced, each designed line with the proof the couple approved (docs/adr/0007), who paid, where it goes and what Stripe charged. The workshop needs them to make and send what was ordered, and no one else may see them: an order holds a customer's name, email, phone and address.

So the studio has the workshop's pages, `/studio/atelier` for the list and `/studio/atelier/J1001` for one order, and Convex answers them only for the team:

- **Queries over the orders, not a copy.** The list reads the `orders` table newest first, a page at a time (`workshop.orders`), and an order's page reads one by its number (`workshop.order`). A paid order shows the moment it's recorded, and nothing keeps a second record of it. Until the checkout moved, the list read Shopify's orders through the Admin API each time it opened; none of that remains.
- **The team signs in as couples do.** An emailed code (docs/adr/0011) proves the address is theirs, and the pages open to the accounts whose address is in `WORKSHOP_EMAILS` on the Convex deployment. Every query checks it (`requireWorkshop` in `convex/workshop/staff.ts`). Google sign-in was the first plan: a code needs no OAuth client, works on every preview and on any address the studio is served from, and is one way in for the team to learn.
- **What an order's page shows**: each line with its proof's picture or the product's photo, its quantity, price and options, the answers the couple wrote, the event a digital invitation was bought for, and a print file for each designed line (docs/adr/0010); the fees, delivery, discount, total and the VAT in it; who paid, the language their emails speak, and where it goes; links to the couple's order page and to the payment in Stripe's dashboard.

## Consequences

- Each deployment lists the team's addresses in `WORKSHOP_EMAILS`, production included; while it's unset, the pages open to no one. A preview writes its sign-in codes to its logs (`AUTH_LOG_CODES`), so whoever reads those can sign in there as a listed address; previews take test payments only.
- A team member's account is an account like any other: designs made in that browser before signing in move to it.
- Orders paid in Stripe's test mode show with a Test mark.
- The Shopify list checked each line against the catalog, since the shop's cart set the extras' price there. Convex prices every line itself when the couple goes to pay, from its own catalog, so those checks have nothing left to catch.
- The pages only read orders for now. Marking an order made or sent, its AWB, the team's notes and refunds come next, on the same pages.
