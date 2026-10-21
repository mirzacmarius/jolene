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
| `packages/backend` | Convex backend: designs, the couple's details, collections, proofs, sign-in, the workshop's order list |
| `packages/design` | The design document: schema, operations, layout and the React renderer |
| `packages/i18n` | The languages Jolene speaks and how a visitor's is chosen |
| `packages/print` | The print file: a design as a PDF, a page for each ink, with bleed and crop marks (`bun run samples` there makes every template's) |
| `packages/suites` | Jolene's collections as templates, with their artwork (lifted from jolene.ro by `lift/`), a sheet that draws every template (`bun run preview` there) and the invitations the shop's home page shows (`bun run shots` there) |
| `packages/ui` | Shared UI components (shadcn/Tailwind) |
| `tooling/typescript` | Shared TypeScript config |
| `brand` | Jolene's logo, and the script that makes every icon and share image from it |

## Getting started

Requires [Bun](https://bun.sh) and Node 24.

```sh
bun install
bun run setup        # configures a Convex deployment, points the studio at it and seeds Jolene's collections
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
- **Backend:** a Convex project, whose deploy keys the studio project keeps in `CONVEX_DEPLOY_KEY`: the production key for Production, the preview key for Preview. Each studio build deploys the Convex functions first (`packages/backend/scripts/vercel-build-studio.sh`); previews get one Convex preview deployment per branch, seeded with Jolene's collections. Their artwork ships with the studio (docs/adr/0005).
- **Sign-in keys:** Convex Auth signs sessions with `JWT_PRIVATE_KEY` and `JWKS` on the Convex deployment and sends sign-in redirects to its `SITE_URL`. A studio build gives a deployment without keys (each new preview, and production on its first build) a fresh pair, with the studio's Vercel URL as `SITE_URL`. Google sign-in completes only there, so the workshop signs in at `SITE_URL` + `/atelier`; set it to `https://jolene.ro/studio` once jolene.ro serves the studio, for the workshop to sign in there.
- **Workshop:** `/studio/atelier` lists the store's open orders for Jolene's workshop, read from Shopify each time (docs/adr/0009). It needs, in the production Convex deployment's environment:
  - `AUTH_GOOGLE_ID` and `AUTH_GOOGLE_SECRET`, from an OAuth client in Google Cloud (a web application) whose redirect URI is the deployment's `https://<name>.convex.site/api/auth/callback/google`;
  - `WORKSHOP_EMAILS`, the workshop's Google addresses, comma-separated;
  - `SHOPIFY_STORE_DOMAIN`, `SHOPIFY_CLIENT_ID` and `SHOPIFY_CLIENT_SECRET`, the same as the Products workflow's (`packages/products`).

  Without them the page says what's missing; couples sign in and design as before.

  Each line with a proof has a print file button: the studio makes the PDF from the proof the couple approved, and lists what its checks found (docs/adr/0010).
