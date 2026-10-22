# Jolene's shop

jolene.ro's storefront: the home page, the catalog's categories and products, search, the cart, checkout through Stripe and each order's page, in Next.js. It sells from Convex (`packages/backend`), where the catalog, prices, carts and orders live; the designer at `/studio` is another app on the same domain (`apps/studio`).

It started from the [Vercel Shop](https://vercel.shop) template, whose Next.js patterns and code style it keeps; `AGENTS.md` says how it's built.

## Running it

From the repository root, after `bun install` and `bun run setup` (which writes this app's `.env.local`):

```sh
bun run dev:shop   # http://localhost:3000
bun run dev        # the shop, the studio and Convex, together at http://localhost:3024
```

The shop needs one variable, `NEXT_PUBLIC_CONVEX_URL`, and production takes `SHOP_SECRET` too, the secret it shares with Convex for opening Stripe's page, and `SITE_PASSWORD` while the site isn't public (see `.env.example`).

## Checks

```sh
bun run lint        # oxlint, and oxfmt's check
bun run typecheck
```

## Deploying

The `jolene` Vercel project builds this folder with `packages/backend/scripts/vercel-build-shop.sh`, which deploys the Convex functions and seeds the catalog before building. It needs `CONVEX_DEPLOY_KEY`: the production key for Production, the preview key for Preview, as the studio's project has. With any other kind of key, such as a development deployment's, the build stops rather than build the shop against another deployment than the studio's.

## License

MIT, as the template; see `LICENSE` and `THIRD-PARTY-NOTICES.md`.
