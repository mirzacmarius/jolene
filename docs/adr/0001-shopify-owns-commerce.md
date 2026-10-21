# Shopify owns commerce, through Vercel Shop

Superseded by [ADR 0015](0015-jolene-sells-through-its-own-checkout.md): Jolene sells through its own cart and Stripe Checkout.

jolene.ro moves off WooCommerce to a Shopify store with a Next.js storefront built from the Vercel Shop template (`apps/shop`). Shopify owns the catalog, prices in lei, carts, checkout, payments, customer accounts and orders; the storefront owns pages, SEO and the agent-readable surface; the studio owns designs, in Convex. We chose Shopify for its checkout and payments, which Jolene would otherwise have to build and keep secure, and Vercel Shop because it gives a fast, agent-ready storefront we control, in the same stack as the studio.

The choice was made as a first step that could be revisited, so commerce stays behind one boundary: the studio holds no prices, carts or orders, and hands a finished design to the shop's cart. Replacing Shopify later means replacing `apps/shop` and that handoff, not the studio.

## Consequences

- WooCommerce products, customers and orders move to Shopify, and the old `/produs/…` addresses redirect to their new pages.
- A cart line refers to its design, so the order Shopify sends the workshop can fetch the design's print files from Convex.
- The shop keeps the template's structure, linting and TypeScript version, so new template releases can be merged in (`update-shop`).
