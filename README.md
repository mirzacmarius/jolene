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
| `packages/backend` | Convex backend: designs, the couple's details, collections, accounts, digital invitations and their replies |
| `packages/design` | The design document: schema, operations, layout and the React renderer |
| `packages/i18n` | The languages Jolene speaks and how a visitor's is chosen |
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

Signing in to an account sends a code by email. The deployment `bun run setup` configures, and each studio preview's, write the codes to their logs instead (`AUTH_LOG_CODES=1`; `bun run dev:backend` shows them), until they have a `RESEND_API_KEY`.

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

- **Hosting:** two Vercel projects from this repository, in one microfrontends group (the team's Settings, Microfrontends). The shop (`jolene`, root directory `apps/shop`) is the group's default app and serves jolene.ro; `apps/shop/microfrontends.json` sends `/studio`, and guests' `/invitatie`, to the studio (`jolene-studio`, root directory `apps/studio`), on the live site and on every preview (docs/adr/0004).
- **Shopify:** the Shopify integration from the Vercel Marketplace gives the shop project its `NEXT_PUBLIC_SHOPIFY_STORE_DOMAIN`, `NEXT_PUBLIC_SHOPIFY_STOREFRONT_ACCESS_TOKEN` and `NEXT_PUBLIC_SHOPIFY_SHOP_ID`. Prices, carts and checkout are in lei, for Romania (`apps/shop/lib/config/index.ts`).
- **Backend:** a Convex project, whose deploy keys the studio project keeps in `CONVEX_DEPLOY_KEY`: the production key for Production, the preview key for Preview. Each studio build deploys the Convex functions first (`packages/backend/scripts/vercel-build-studio.sh`); previews get one Convex preview deployment per branch, seeded with Jolene's collections. Their artwork ships with the studio (docs/adr/0005).
- **Sign-in keys:** Convex Auth signs sessions with `JWT_PRIVATE_KEY` and `JWKS` on the Convex deployment and sends sign-in redirects to its `SITE_URL`. A studio build gives a deployment without keys (each new preview, and production on its first build) a fresh pair, with the studio's Vercel URL as `SITE_URL`. Once jolene.ro serves the studio, set production's `SITE_URL` to `https://jolene.ro/studio`.
- **Emails:** sign-in codes and couples' invitations go through Resend, from a domain it has verified: `RESEND_API_KEY` and `EMAIL_FROM` on the Convex deployment, and `RESEND_WEBHOOK_SECRET` for Resend's webhook to `https://<deployment>.convex.site/resend-webhook`, which tells couples which emails bounced (docs/adr/0011).
- **Guests' address:** guests open digital invitations at `invitatie.orvibo.it`, a domain of the shop project, which sends an invitation's short link there to `/invitatie` on the same address; `INVITE_URL=https://invitatie.orvibo.it` on Convex production makes families' links with it. Where it isn't set, links use `/invitatie` at `SITE_URL`'s address. A link sent keeps working while its address stays on the shop project, so a new address for guests only needs adding there and in `INVITE_URL` (docs/adr/0013).
- **Unlocking digital invitations:** the checkout's paid orders unlock the invitations they paid for, through `unlockPaid` in `packages/backend/convex/invites/unlock.ts`. Until it sells them, Jolene's team unlocks one by hand by running `invites/unlock:byHand` in the Convex dashboard, with the event's id from the couple's email (docs/adr/0014).
