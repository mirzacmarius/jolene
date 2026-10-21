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
- **Payments:** `STRIPE_SECRET_KEY` on a Convex deployment opens its checkout: a test key until launch, set for previews among the Convex project's default environment variables. Stripe advises a restricted key (`rk_test_…`) over the secret key: give it Write on Checkout Sessions, Products, Prices and Shipping Rates, which Stripe makes for each checkout's lines and delivery, and Read on Tax Settings. Stripe sends couples back to the shop at `SHOP_URL`, which the shop's build sets: a preview's own address, or the shop's production domain when production has none (set it to `https://jolene.ro` once that serves the shop). Production records orders from Stripe's webhook: an endpoint to `https://<deployment>.convex.site/stripe-webhook` for `checkout.session.completed` and `checkout.session.async_payment_succeeded`, with its signing secret in `STRIPE_WEBHOOK_SECRET`. A deployment without one, such as a preview, records orders when the couple comes back from Stripe and by an hourly check. The team hears of each order at `ORDERS_EMAIL`, and couples' replies to their confirmation go there. Before launch, give the shop's Vercel project (Production) and then Convex production the same long random `SHOP_SECRET`: Stripe's page then opens only for the shop's server, which tells Convex each visitor's address, so each visitor has a limit of their own and no one script can use up the checkouts everyone shares. In the other order, checkout refuses the shop until it has the secret.
- **VAT:** prices include VAT. Stripe Tax works out the VAT in each payment once it's set up in the Stripe account (Tax settings: the head office and a preset product tax code), and only where the account has a registration, so add Romania's under Tax, Locations. Orders, their emails and their page then show it; until then they show none, and the team's notice says so when Stripe Tax found none to charge.
- **Invoices:** SmartBill issues each paid order's invoice, whose PDF the couple's email and order page link to (docs/adr/0018). It sends invoices to e-Factura once that's turned on in SmartBill's settings. A Convex deployment issues them once it has `SMARTBILL_USERNAME` (the SmartBill account's email), `SMARTBILL_TOKEN` (its API token, under Contul Meu, Integrări, API) and `SMARTBILL_SERIES` (the series to number them in), and `SMARTBILL_CIF` when the company issuing them isn't Jolene Design SRL. Set them on production only: a test order's invoice is a draft, which SmartBill neither numbers nor sends on.
- **Photos:** the shop shows the catalog's photos from the photo store, the public Vercel Blob store `jolene-photos` connected to the shop's project, whose token Vercel keeps in the shop's Production `BLOB_READ_WRITE_TOKEN` (docs/adr/0016). `photoStore` in `packages/products/src/photos.ts` holds its address, and its host is among `images.remotePatterns` in `apps/shop/next.config.ts`. Each production build of the shop also copies from jolene.ro any photo the store lacks, such as a new product's, which shows once that build has copied it.
- **Backend:** a Convex project, whose deploy keys both Vercel projects keep in `CONVEX_DEPLOY_KEY`: the production key for Production, the preview key for Preview. Each build of either deploys the Convex functions and seeds Jolene's collections and catalog (`packages/backend/scripts/vercel-build-studio.sh`, `vercel-build-shop.sh`); previews get one Convex preview deployment per branch. The collections' artwork ships with the studio (docs/adr/0005).
- **Sign-in keys:** Convex Auth signs sessions with `JWT_PRIVATE_KEY` and `JWKS` on the Convex deployment and sends sign-in redirects to its `SITE_URL`. A studio build gives a deployment without keys (each new preview, and production on its first build) a fresh pair, with the studio's Vercel URL as `SITE_URL`. Once jolene.ro serves the studio, set production's `SITE_URL` to `https://jolene.ro/studio`.
- **Emails:** sign-in codes and couples' invitations go through Resend, from a domain it has verified: `RESEND_API_KEY` and `EMAIL_FROM` on the Convex deployment, and `RESEND_WEBHOOK_SECRET` for Resend's webhook to `https://<deployment>.convex.site/resend-webhook`, which tells couples which emails bounced (docs/adr/0011).
- **Guests' address:** guests open digital invitations at `invitatie.orvibo.it`, a domain of the shop project, which sends an invitation's short link there to `/invitatie` on the same address; `INVITE_URL=https://invitatie.orvibo.it` on Convex production makes families' links with it. Where it isn't set, links use `/invitatie` at `SITE_URL`'s address. A link sent keeps working while its address stays on the shop project, so a new address for guests only needs adding there and in `INVITE_URL` (docs/adr/0013).
- **The workshop:** Jolene's team sees every paid order at `/studio/atelier`, newest first, and each order on its own page: the couple's proofs, what they chose and wrote, who paid and where it goes, and a print file for each designed line (docs/adr/0009, docs/adr/0010). The team moves each order on, from paid to being made, then sent or ready to pick up, then complete (or cancelled), and writes notes on it that only the team reads; the couple's order page shows how far it has come. The team signs in with an emailed code, as couples do, and the pages open to the addresses in `WORKSHOP_EMAILS` on the Convex deployment, comma-separated: to no one while it's unset.
- **Guest lists:** a daily job deletes each digital invitation's guest list, its replies and the emails of its invitations, as many months after the event as the workshop sets at `/studio/atelier/setari` (12 to 24, 12 until someone changes it), and closes the invitation's open link; an event without a date, or with one from before its invitation, counts from the invitation's last change. Another deletes the Resend component's copies of sent emails after 30 days. The privacy policy promises both, so change it with them (docs/adr/0017).
- **Unlocking digital invitations:** the checkout's paid orders unlock the invitations they paid for, through `unlockPaid` in `packages/backend/convex/invites/unlock.ts`: the digital invitation unlocks the event its cart line carries, and printed invitations from an invitation's proof unlock the proof's event. The studio's "Deblocați-o" opens the digital invitation's page in the shop with the event. For a couple who paid another way, Jolene's team unlocks one by hand by running `invites/unlock:byHand` in the Convex dashboard, with the event's id from the couple's email (docs/adr/0014).
