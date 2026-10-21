# Jolene sells through its own cart and Stripe Checkout

Jolene sells from its own catalog, cart and orders, kept in Convex, and takes payment through Stripe Checkout. Shopify leaves the project, so this replaces ADR 0001 and the Shopify parts of ADR 0008. Selling on Shopify needed a paid plan before the shop could even be tested, and Shopify's limits had shaped how the catalog sells (ADR 0008). Stripe charges per payment only, and Jolene's orders are simple enough to own: one currency, made to order, mostly from a proof.

ADR 0001's boundary holds: the shop owns selling (the catalog's pages, the cart, checkout and the couple's order page) and the studio owns designs and proofs. What moves is where selling keeps its data: Convex, beside the designs it sells.

- **The catalog lives in Convex.** The studio's seed loads it from `packages/products/catalog`, the lift from jolene.ro: products under their jolene.ro names, their papers, order options, fees, minimum orders and categories. ADR 0008's meanings stay without its workarounds: a line costs its paper plus its paid choices, and an order carries its own fees.
- **Prices are whole bani** wherever they are kept or added up (1 leu is 100 bani), as Stripe counts them.
- **The shop reads Convex on its server**, from the deployment its build deploys to, the same way the studio's build does, and caches what its pages read under tags.
- **Carts live in Convex.** A cart's only key is a long random token the shop's server keeps in an httpOnly cookie, and Convex prices each line from the catalog as it is when the cart is read, saying what stops a line being ordered: a product off sale, an option left unanswered or changed, a quantity under the minimum.
- **Stripe takes the payment** on its own Checkout page, for the cart as Convex prices it when the couple goes to pay, never from what the browser sends. Convex keeps that pricing as the checkout, and the order is made from it.
- **An order is recorded once for each Checkout Session**, by whichever comes first: Stripe's signed webhook, the couple coming back to the shop, or an hourly look at the day's paid sessions. Each asks Stripe's API for the session rather than trusting what it was sent, and a session no checkout of this deployment opened is left alone. The paid lines leave the cart.
- **Delivery is chosen on Stripe's page** from the options Convex gives it (`convex/checkout/delivery.ts`): for now one courier in Romania, at a price that stands in until Jolene sets its couriers and prices.
- **Orders are numbered** from J1001. Each has a page in the shop at a long random address, which the couple's emails link to; the couple gets a confirmation and Jolene's team a notice.
- **Photos move off jolene.ro** into Convex storage, resized for the web, before jolene.ro's domain moves to the shop. Until then the catalog shows them from jolene.ro.

## Consequences

- The shop's Vercel project needs the studio's `CONVEX_DEPLOY_KEY`: the production key for production and the preview key for previews. A build without one has no catalog.
- Both projects' builds deploy the same Convex functions to the same deployment and seed it, so whichever builds first brings the catalog, and the shop's pages are built with it.
- The shop drops Hydrogen, the Storefront and Customer Account APIs, Shopify's analytics and the template's Shop Agent. It keeps the template's Next.js patterns and code style but no longer follows its releases, so `update-shop` and the template's Shopify skills go.
- ADR 0007 holds, but the shop reads a proof from Convex itself and a cart line keeps the proof's id, so the studio's `/studio/api/proofs` route and the line's attributes go. The shop's answers about a product, its Markdown page included, are cached for minutes, since Convex sends no webhook, so ADR 0007's wait for Shopify's webhooks goes too.
- `packages/products` keeps the lift and loses the sync to Shopify and its workflow.
- A product edited in Convex keeps its edits: the seed brings in the repository's changes only to products nobody has edited since.
- Stripe can't take cash on delivery.
- A Convex deployment takes payments once it has `STRIPE_SECRET_KEY`; until then the cart says paying online opens soon. Production also needs Stripe's webhook to `https://<deployment>.convex.site/stripe-webhook` and its `STRIPE_WEBHOOK_SECRET`. Previews, which share Stripe's test mode with production until launch, need no webhook of their own: they record orders as couples come back and by the hourly check, and production's webhook passes over their sessions.
- Order emails go through Resend, as sign-in codes do (ADR 0011). Until the team's own screens come, an order's details are in its notice email, Convex's dashboard and Stripe's.
