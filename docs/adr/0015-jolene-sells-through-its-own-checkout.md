# Jolene sells through its own cart and Stripe Checkout

Jolene sells from its own catalog, cart and orders, kept in Convex, and takes payment through Stripe Checkout. Shopify leaves the project, so this replaces ADR 0001 and the Shopify parts of ADR 0008. Selling on Shopify needed a paid plan before the shop could even be tested, and Shopify's limits had shaped how the catalog sells (ADR 0008). Stripe charges per payment only, and Jolene's orders are simple enough to own: one currency, made to order, mostly from a proof.

ADR 0001's boundary holds: the shop owns selling (the catalog's pages, the cart, checkout and the couple's order page) and the studio owns designs and proofs. What moves is where selling keeps its data: Convex, beside the designs it sells.

- **The catalog lives in Convex.** The studio's seed loads it from `packages/products/catalog`, the lift from jolene.ro: products under their jolene.ro names, their papers, order options, fees, minimum orders and categories. ADR 0008's meanings stay without its workarounds: a line costs its paper plus its paid choices, and an order carries its own fees.
- **Prices are whole bani** wherever they are kept or added up (1 leu is 100 bani), as Stripe counts them.
- **The shop reads Convex on its server**, from the deployment its build deploys to, the same way the studio's build does, and caches what its pages read under tags.
- **Carts live in Convex.** A cart's only key is a long random token the shop's server keeps in an httpOnly cookie, and Convex prices each line from the catalog as it is when the cart is read, saying what stops a line being ordered: a product off sale, an option left unanswered or changed, a quantity under the minimum.
- **Stripe takes the payment** on its own Checkout page, for a total the shop's server works out from the cart and the catalog, never from what the browser sends. Stripe's signed message records the order in Convex, once for each Checkout session.
- **Photos move off jolene.ro** into Convex storage, resized for the web, before jolene.ro's domain moves to the shop. Until then the catalog shows them from jolene.ro.

## Consequences

- The shop's Vercel project needs the studio's `CONVEX_DEPLOY_KEY`: the production key for production and the preview key for previews. A build without one has no catalog.
- Both projects' builds deploy the same Convex functions to the same deployment and seed it, so whichever builds first brings the catalog, and the shop's pages are built with it.
- The shop drops Hydrogen, the Storefront and Customer Account APIs, Shopify's analytics and the template's Shop Agent. It keeps the template's Next.js patterns and code style but no longer follows its releases, so `update-shop` and the template's Shopify skills go.
- ADR 0007 holds, but the shop reads a proof from Convex itself and a cart line keeps the proof's id, so the studio's `/studio/api/proofs` route and the line's attributes go. The shop's answers about a product, its Markdown page included, are cached for minutes, since Convex sends no webhook, so ADR 0007's wait for Shopify's webhooks goes too.
- `packages/products` keeps the lift and loses the sync to Shopify and its workflow.
- A product edited in Convex keeps its edits: the seed brings in the repository's changes only to products nobody has edited since.
- Stripe can't take cash on delivery.
