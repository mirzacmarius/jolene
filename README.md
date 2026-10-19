# Jolene

Wedding and christening stationery that couples design themselves, with Jolene's
designs and an AI co-designer, then order printed.

- Domain glossary: [`GLOSSARY.md`](GLOSSARY.md)
- Architecture decisions: [`docs/adr/`](docs/adr/)

## Layout

| Path | What it is |
|---|---|
| `apps/shop` | The storefront at jolene.ro: Vercel Shop on Shopify (Next.js), port 3000 |
| `apps/studio` | The designer, at `/studio` on the shop's domain (Next.js), port 3001 |
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
bun run dev:studio   # the designer: http://localhost:3024/studio
```

`bun run setup` asks you to log in to Convex, or to start without an account and run Convex locally. Agents and CI can skip the prompt with `CONVEX_AGENT_MODE=anonymous bun run setup`.

Port 3024 is the microfrontends proxy, which `turbo dev` starts: it serves both apps on one address, as jolene.ro does, and sends the shop's pages to the live shop when the shop isn't running here. To run the shop too, copy `apps/shop/.env.example` to `apps/shop/.env.local`, fill in the three Shopify values, and run `bun run dev`, which also runs Convex.

## Checks

```sh
bun run lint          # Biome, the shop's oxlint and oxfmt, and monorepo consistency
bun run format:check
bun run typecheck
bun run test          # unit tests: *.test.ts next to the module, on bun:test
```

CI (`.github/workflows/check.yml`) runs all four on every push, then builds the studio with `next build` against a placeholder Convex URL, without any secrets. The shop isn't built in CI, because its build reads the Shopify store.

## Deployments

- **Hosting:** two Vercel projects from this repository, in one microfrontends group (the team's Settings, Microfrontends). The shop (`jolene`, root directory `apps/shop`) is the group's default app and serves jolene.ro; `apps/shop/microfrontends.json` sends `/studio` to the studio (`jolene-studio`, root directory `apps/studio`), on the live site and on every preview (docs/adr/0004).
- **Shopify:** the Shopify integration from the Vercel Marketplace gives the shop project its `NEXT_PUBLIC_SHOPIFY_STORE_DOMAIN`, `NEXT_PUBLIC_SHOPIFY_STOREFRONT_ACCESS_TOKEN` and `NEXT_PUBLIC_SHOPIFY_SHOP_ID`. Prices, carts and checkout are in lei, for Romania (`apps/shop/lib/config/index.ts`).
- **Backend:** a Convex project, connected to the studio project through the Convex integration on Vercel, which sets `CONVEX_DEPLOY_KEY` for Production and Preview. Each studio build deploys the Convex functions first (`packages/backend/scripts/vercel-build-studio.sh`); previews get one Convex preview deployment per branch, seeded with the starter collection.
- **Sign-in keys:** Convex Auth signs sessions with `JWT_PRIVATE_KEY` and `JWKS` on the Convex deployment and sends sign-in redirects to its `SITE_URL`. A studio build gives a deployment without keys (each new preview, and production on its first build) a fresh pair, with the studio's Vercel URL as `SITE_URL`. Once jolene.ro serves the studio, set production's `SITE_URL` to `https://jolene.ro/studio`.
