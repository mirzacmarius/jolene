# Jolene

Wedding and christening stationery that couples design themselves, with Jolene's
designs and an AI co-designer, then order printed.

- Domain glossary: [`GLOSSARY.md`](GLOSSARY.md)
- Architecture decisions: [`docs/adr/`](docs/adr/)

## Layout

| Path | What it is |
|---|---|
| `apps/shop` | The storefront at jolene.ro: the catalog, search and cart, from Convex (Next.js), port 3000 |
| `apps/studio` | The designer, at `/studio` on the shop's domain (Next.js), port 3001 |
| `packages/backend` | Convex backend: designs, the couple's details, collections, accounts, digital invitations and their replies, the shop's catalog and carts |
| `packages/design` | The design document: schema, operations, layout and the React renderer |
| `packages/products` | jolene.ro's catalog, lifted from its WooCommerce shop, which the seed loads into Convex |
| `packages/i18n` | The languages Jolene speaks and how a visitor's is chosen |
| `packages/suites` | Jolene's collections as templates, with their artwork (lifted from jolene.ro by `lift/`), a sheet that draws every template (`bun run preview` there) and the invitations the shop's home page shows (`bun run shots` there) |
| `packages/ui` | Shared UI components (shadcn/Tailwind) |
| `tooling/typescript` | Shared TypeScript config |
| `brand` | Jolene's logo, and the script that makes every icon and share image from it |

## Getting started

Requires [Bun](https://bun.sh) and Node 24.

```sh
bun install
bun run setup        # configures a Convex deployment, points the studio and the shop at it and seeds Jolene's collections and catalog
bun run dev:studio   # the designer: http://localhost:3024/studio
```

`bun run setup` asks you to log in to Convex, or to start without an account and run Convex locally. Agents and CI can skip the prompt with `CONVEX_AGENT_MODE=anonymous bun run setup`.

Signing in to an account sends a code by email. The deployment `bun run setup` configures, and each studio preview's, write the codes to their logs instead (`AUTH_LOG_CODES=1`; `bun run dev:backend` shows them), until they have a `RESEND_API_KEY`.

Port 3024 is the microfrontends proxy, which `turbo dev` starts: it serves both apps on one address, as jolene.ro does, and sends the shop's pages to the live shop when the shop isn't running here. To run the shop too, run `bun run dev`, which also runs Convex.

## Checks

```sh
bun run lint          # Biome, the shop's oxlint and oxfmt, and monorepo consistency
bun run format:check
bun run typecheck
bun run test          # unit tests: *.test.ts next to the module, on bun:test
```

CI (`.github/workflows/check.yml`) runs all four on every push, then builds the studio with `next build` against a placeholder Convex URL, without any secrets. The shop isn't built in CI, because its build reads the catalog from a Convex deployment.

## Deployments

- **Hosting:** two Vercel projects from this repository, in one microfrontends group (the team's Settings, Microfrontends). The shop (`jolene`, root directory `apps/shop`) is the group's default app and serves jolene.ro; `apps/shop/microfrontends.json` sends `/studio`, and guests' `/invitatie`, to the studio (`jolene-studio`, root directory `apps/studio`), on the live site and on every preview (docs/adr/0004).
- **Selling:** the shop reads the catalog and keeps carts in Convex, in lei, for Romania, and takes payment through Stripe Checkout (docs/adr/0015).
- **Payments:** `STRIPE_SECRET_KEY` on a Convex deployment opens its checkout: a test key (`sk_test_…`) until launch, set for previews among the Convex project's default environment variables. Stripe sends couples back to the shop at `SHOP_URL`, which the shop's build sets: a preview's own address, or the shop's production domain when production has none (set it to `https://jolene.ro` once that serves the shop). Production records orders from Stripe's webhook: an endpoint to `https://<deployment>.convex.site/stripe-webhook` for `checkout.session.completed` and `checkout.session.async_payment_succeeded`, with its signing secret in `STRIPE_WEBHOOK_SECRET`. A deployment without one, such as a preview, records orders when the couple comes back from Stripe and by an hourly check. The team hears of each order at `ORDERS_EMAIL`, and couples' replies to their confirmation go there.
- **Backend:** a Convex project, whose deploy keys both Vercel projects keep in `CONVEX_DEPLOY_KEY`: the production key for Production, the preview key for Preview. Each build of either deploys the Convex functions and seeds Jolene's collections and catalog (`packages/backend/scripts/vercel-build-studio.sh`, `vercel-build-shop.sh`); previews get one Convex preview deployment per branch. The collections' artwork ships with the studio (docs/adr/0005).
- **Sign-in keys:** Convex Auth signs sessions with `JWT_PRIVATE_KEY` and `JWKS` on the Convex deployment and sends sign-in redirects to its `SITE_URL`. A studio build gives a deployment without keys (each new preview, and production on its first build) a fresh pair, with the studio's Vercel URL as `SITE_URL`. Once jolene.ro serves the studio, set production's `SITE_URL` to `https://jolene.ro/studio`.
- **Emails:** sign-in codes and couples' invitations go through Resend, from a domain it has verified: `RESEND_API_KEY` and `EMAIL_FROM` on the Convex deployment, and `RESEND_WEBHOOK_SECRET` for Resend's webhook to `https://<deployment>.convex.site/resend-webhook`, which tells couples which emails bounced (docs/adr/0011).
- **Guests' address:** guests open digital invitations at `invitatie.jolene.ro`, a domain of the shop project, which sends an invitation's short link there to `/invitatie` on the same address; `INVITE_URL=https://invitatie.jolene.ro` on Convex makes families' links with it. Until it is set they use `/invitatie` at `SITE_URL`'s address, so set it before couples start sending (docs/adr/0013).
- **Unlocking digital invitations:** the checkout's paid orders unlock the invitations they paid for, through `unlockPaid` in `packages/backend/convex/invites/unlock.ts`: printed invitations from an invitation's proof unlock its event. Until the shop sells the digital invitation itself, Jolene's team unlocks one by hand by running `invites/unlock:byHand` in the Convex dashboard, with the event's id from the couple's email (docs/adr/0014).
