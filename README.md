# Jolene

Wedding and christening stationery that couples design themselves, with Jolene's
designs and an AI co-designer, then order printed.

- Domain glossary: [`GLOSSARY.md`](GLOSSARY.md)
- Architecture decisions: [`docs/adr/`](docs/adr/)

## Layout

| Path | What it is |
|---|---|
| `apps/shop` | The storefront at jolene.ro: Vercel Shop on Shopify (Next.js), port 3000 |
| `apps/studio` | The designer, served under `/studio` (Next.js), port 3001 |
| `packages/backend` | Convex backend: designs, the couple's details, collections, sign-in |
| `packages/design` | The design document: schema, operations, layout and the React renderer |
| `packages/i18n` | The languages Jolene speaks and how a visitor's is chosen |
| `packages/ui` | Shared UI components (shadcn/Tailwind) |
| `tooling/typescript` | Shared TypeScript config |

## Getting started

Requires [Bun](https://bun.sh) and Node 24.

```sh
bun install
bun run setup        # configures a Convex deployment, points the studio at it and seeds a collection
bun run dev:studio   # the designer and Convex: http://localhost:3001/studio
```

`bun run setup` asks you to log in to Convex, or to start without an account and run Convex locally. Agents and CI can skip the prompt with `CONVEX_AGENT_MODE=anonymous bun run setup`.

The shop needs a Shopify store. Copy `apps/shop/.env.example` to `apps/shop/.env.local`, fill in the three Shopify values, then run `bun run dev:shop` next to the studio: http://localhost:3000/studio serves the designer through the shop, as jolene.ro does.

## Checks

```sh
bun run lint          # Biome, the shop's oxlint and oxfmt, and monorepo consistency
bun run format:check
bun run typecheck
bun run test          # unit tests: *.test.ts next to the module, on bun:test
```

CI (`.github/workflows/check.yml`) runs all four on every push, then builds the studio with `next build` against a placeholder Convex URL, without any secrets. The shop isn't built in CI, because its build reads the Shopify store.

## Deployments

- **Hosting:** two Vercel projects from this repository. The shop (root directory `apps/shop`) is jolene.ro; the studio (root directory `apps/studio`) runs on its own URL, and the shop rewrites `/studio` to it (docs/adr/0003).
- **Links between the apps:** set the shop's `STUDIO_URL` to the studio's production URL, and the studio's `NEXT_PUBLIC_SHOP_URL` to the shop's. A shop preview shows the production studio unless its `STUDIO_URL` says otherwise.
- **Shopify:** the Shopify integration from the Vercel Marketplace gives the shop project its `NEXT_PUBLIC_SHOPIFY_STORE_DOMAIN`, `NEXT_PUBLIC_SHOPIFY_STOREFRONT_ACCESS_TOKEN` and `NEXT_PUBLIC_SHOPIFY_SHOP_ID`. Prices, carts and checkout are in lei, for Romania (`apps/shop/lib/config/index.ts`).
- **Backend:** a Convex project, connected to the studio project through the Convex integration on Vercel, which sets `CONVEX_DEPLOY_KEY` for Production and Preview. Each studio build deploys the Convex functions first (`packages/backend/scripts/vercel-build-studio.sh`); previews get one Convex preview deployment per branch, seeded with the starter collection.
- **Sign-in keys:** Convex Auth signs sessions with `JWT_PRIVATE_KEY` and `JWKS` on the Convex deployment. For production, run `bun scripts/set-auth-keys.ts https://jolene.ro/studio --prod` in `packages/backend`. For previews, generate a pair the same way against a dev deployment and copy both values into the Convex project's default environment variables for preview deployments.
