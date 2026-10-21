# Jolene's shop

The shop is jolene.ro's storefront: the home page, the catalog's categories and products, search, the cart, checkout and each order's page. It started from the Vercel Shop template (2026.10.0) and keeps its Next.js patterns and code style, but it sells from Convex (ADR 0015), not Shopify.

## In the Jolene monorepo

- Bun runs the workspace: `bun run dev:shop` from the repository root, or `bun run <script>` here.
- The shop keeps the template's oxlint, oxfmt and TypeScript 7; Biome skips this folder.
- Environment variables are declared in the root `turbo.json`, under the build task's `env`.
- `/studio` belongs to the designer (`apps/studio`), another app on this domain, and so does `/invitatie`, where guests open digital invitations: `microfrontends.json` routes both there before this app sees the request. Link to them with a plain `<a>`, never `Link`, so the browser loads the other app. On the guests' own address, invitatie.orvibo.it, `next.config.ts` redirects an invitation's short link to `/invitatie`.
- Vercel builds the shop with `packages/backend/scripts/vercel-build-shop.sh`: it deploys the Convex functions to the studio's deployment (production, or the branch's preview), seeds the catalog, then builds against it. Locally, `bun run setup` at the root writes `NEXT_PUBLIC_CONVEX_URL` to `.env.local`.
- jolene.ro's blog comes from `@jolene/products/blog`, lifted from its WordPress. Each post keeps its old address, `/<slug>`, which `next.config.ts` rewrites to `app/blog/[slug]`; `proxy.ts` answers 404 to `/blog/<slug>` itself, so a post has one address and an unknown one is a real 404. `next.config.ts` also redirects jolene.ro's other WordPress and WooCommerce addresses.
- Order options, papers, fees and minimum orders (ADR 0008) come with each product from `api.shop.product`. The product page shows a line's price as the couple chooses; the cart, priced by Convex, says what stops a line being ordered (`convex/shop/pricing.ts`).

## Two owners

Every feature belongs to one owner. If a change can't name its owner, or reaches into the other's territory, redesign it.

**Convex owns selling** (`packages/backend/convex`).

- Owns: the catalog (products, papers, order options, fees, categories, photos), prices in bani, carts and their lines, what a line costs and whether it can be ordered, proofs, Stripe's Checkout Sessions, delivery prices, and orders with their emails.
- Lives in: `shop.ts` (catalog reads), `shop/` (loading, pricing, validators), `cart.ts`, `proofs.ts`, `checkout.ts` and `checkout/` (Stripe), `orders.ts` and `orders/`.
- Must not be reimplemented here: totals, fees, minimums, what stops a line, and anything that talks to Stripe. The product page's running price is the one exception, worked out in `lib/line-options/` from the same catalog data the cart prices from.

**Next.js owns the app.**

- Owns: routing and clean URLs, Server Components, caching and tags, metadata and SEO, Suspense and loading geometry, the cart's cookie, and the answer-engine surface: `text/markdown` negotiation, Markdown representations, `/llms.txt`, Schema.org data, the sitemap and robots.
- Lives in: `app/`, `components/`, `lib/<domain>/{index,server,client,action,types}.ts`, `lib/config/`, `next.config.ts`, `proxy.ts`; the answer-engine surface in `lib/markdown/**`, `lib/seo/**`, `app/md/**`, `app/llms.txt/`, `app/sitemap.xml/`, `app/robots.ts`, `components/schema/`.

## Boundary rules

1. **Commerce facts come from Convex.** Read them with `fetchQuery` from `convex/nextjs`, on the server only, and derive types from the functions (`FunctionReturnType<typeof api.shop.product>`) rather than writing them by hand. Prices are whole bani everywhere; `lib/money/` formats them.
2. **A cart is its token.** The `jolene_cart` cookie holds a random token, httpOnly, and the token is the cart's only key: `lib/cart/action.ts` makes it on the first add and passes it to `api.cart.*`. The browser never reads it. Components change the cart through `useCartActions()`, and the newest answer wins.
3. **Paying is a redirect.** `lib/checkout/action.ts` asks `api.checkout.start` for Stripe's page, with `SHOP_SECRET` and the visitor's address once it's set, and sends the couple there; Stripe sends them back to `app/checkout/return/`, which asks `api.checkout.confirm` for their order and sends them to its page, `/orders/<token>`. The shop never sees a card or a total it worked out itself.
4. **Convex reads, Next.js caches.** `lib/<domain>/server.ts` exports `get*` functions that own `"use cache: remote"`, `cacheLife` and `cacheTag`. When the workshop changes a product, its page asks `app/api/catalog/refresh` to expire the `products` and `categories` tags, sending the signed-in account's Convex token, which Convex checks against the workshop's list; the seed sends no such word, and the request can fail, so `cacheLife("minutes")` still bounds how stale a page gets. Each list's first page is cached; Load more pages stay live so their cursors meet the catalog as it is. Carts, proofs, orders and invitations' events never enter a public cache, and each read awaits `connection()` first: Next renders a page's prefetch with the visitor's cookies and query, and Convex's client draws a random id, which that render refuses. `getCart` is deduped per request with React `cache`.
5. **`components/ui/` takes primitive props only.** No domain types or content helpers; wrappers in `components/<domain>/` supply labels and data.
6. **Copy is inline, server-first and Romanian for now** (an English version comes later). Keep labels beside their component; reusable content functions go in `lib/content/index.ts`. Pass primitive labels to client leaves, never content functions. The legal pages already speak both: each is at jolene.ro's Romanian address and in English under `/en`, with its text in `components/legal/` and the company's details in `lib/legal/`.
7. **Every user-configurable `process.env.X` read has a row in `.env.example`** with a short comment on when to set it, and every `process.env.X` read is listed in `turbo.json`; Turborepo's strict mode hides undeclared variables and leaves them out of cache keys.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Next.js layer

- Preserve route-level data loading, promise boundaries, cache directives, invalidation tags, metadata and redirects when rebuilding presentation unless the task changes behavior.
- Start independent work together; block rendering only where one result needs another.
- Keep stable headings, primary media, and likely LCP content in the static shell. Push request-time inputs to the smallest Suspense boundary that needs them, with fallbacks that match the resolved geometry.
- Routes with runtime params (products, categories) render a synchronous page that wraps the async content in `Suspense` with a route skeleton. Do not use `loading.tsx`, which serializes the skeleton twice in every document's RSC payload, or `export const instant = false`. Export the skeleton beside the component it mirrors and mark its root `aria-busy="true"`.
- A product page reads `?proof=`, and the digital invitation's page `?event=` (the event it's bought for), inside their own Suspense boundaries, whose fallbacks are the same purchase form, disabled, and an empty picture, so the page stays static around them.
- The default view of a category, `/collections/all` included, ships its cached products in the static shell; `proxy.ts` rewrites sorted URLs to the request-time `refine` route beside it and returns 404 for direct `refine` requests. Keep `SearchParamsProbe` on the default page, or the router reuses it for every search string and the rewrite never runs; keep the toolbar in `CategoryLayout`, which both routes share, and each page's results inside `CategoryBrowseBoundary`, so a sort keeps the toolbar and only the grid falls back. Build browse URLs from the public path, never `usePathname()`.
- The root layout's `ensureStatic = "prefetch"` keeps the App Shell and per-link prefetches static. Keep it at the root; do not add `navigation()` or `prefetch()` per subtree.
- Server Components are the default; isolate state, effects, browser APIs, and handlers in leaf client components.
- Every image uses `next/image` with reserved dimensions and `sizes="100vw"`, including thumbnails: `deviceSizes: [1320, 1920]` ships two assets that every surface reuses. Do not tune `sizes` or add widths. Preload only the LCP image; keep product grids lazy. Photos load from jolene.ro until they're copied into Convex's storage; `next.config.ts` allows both.
- Link internally with `Link` from `@/components/ui/link`, never `next/link`. It upgrades to the per-link prefetch only on intent, so grids never prefetch every card. Any other prefetch change is a production-measured traffic-versus-latency choice.
- Read `shopConfig` from `lib/config/index.ts` directly in server and client code.
- Keep Portless out of `package.json`.

## Testing (temporary policy)

Do not add tests, test files, runners, dependencies, or scripts unless the user explicitly asks; missing coverage is not permission. Verify with existing checks such as lint, typecheck, builds, and runtime or browser checks, run existing tests when relevant, and report what stayed unverified. The Convex functions the shop calls have their own tests in `packages/backend`.

## Environment files

`.env.example` files hold realistic placeholders, never redaction language like `[redacted]`: a `your-…-here` string, or a value in its real format.

## Code Style

### Ordering and exports

- Alphabetize export specifiers, destructuring patterns, interface and type properties, config object keys, and string union members. `bun run format` sorts imports.
- No barrel files: never an `index.ts` that only re-exports.
- Named exports only in component files; pages use default exports.

### Files

- Keep sub-components in their consumer's file when they share a directive, unless the file gets unwieldy. Split a different directive into `foo-client.tsx` or `foo-server.tsx` beside `foo.tsx`.
- Push `"use client"` as far down as possible; pages, layouts, and data-fetching wrappers stay server components and pass promises or data to client children.
- `lib/` is organized by domain, then execution context, using only the files a domain needs: `index.ts` (universal, never a barrel), `server.ts` (kept out of client graphs), `client.ts` or `client.tsx` (a React client boundary, not an HTTP client), `action.ts` (`"use server"`, verb + `Action` exports), and `types.ts` (imported with `import type`). No descriptive siblings like `cart-client.ts`, flat root modules, or forwarding exports.
- Convex reads live in their domain's `server.ts`; pure transforms and formatting helpers live in `index.ts`.
- Storefront models live in their owning domain's `types.ts`; cross-domain primitives in `lib/media/types.ts`. Props stay beside their components, and small private types may stay local. Never import shared types from `server.ts` or `action.ts`. Generated artifacts keep their generator's paths.

### Naming

- Files `kebab-case.tsx`, components `PascalCase`, constants `SCREAMING_SNAKE_CASE`, server actions verb + `Action`.
- Props are `interface {ComponentName}Props`. Native-element pass-through uses `ComponentProps<"div">`.
- One React import per file with named imports and inline `type` modifiers (`import { type ReactNode, Suspense } from "react"`), or `import type` when all are types; never `React.*`.

### Spacing

- `Container` sets horizontal padding and max width only; never put `py-*` on it.
- `Page` owns top padding (`pt-10` by default, overridden through `className`) and has no bottom padding; the footer's `pt-20` provides that gap. Full-height layouts add `flex flex-1 flex-col`.
- Wrap sibling sections in `Sections` (`gap-10` by default). Inside a section, use `grid gap-*` on the parent, never margins or `space-y-*` on children.
- Use the gap scale `gap-2.5`, `gap-4`, `gap-5`, `gap-10`. Padding inside components and negative-margin breakouts are fine.

### Tailwind

- Style with utilities, not `app/globals.css`. Register new values in `@theme`; keep `globals.css` to tokens, resets, keyframes, and shared utilities, with no global element rules.
- `@theme inline` does not emit `:root` variables; outside utilities, reference the underlying variable.
- Prefer scale utilities (`h-18`, `top-1/2`) to arbitrary values, which are for off-scale values such as `calc()` or grid templates.
- Prefer `data-[attr=value]` selectors to conditional classes; use `cn()` when classes must be conditional, `data-slot` as styling hooks, and `cva` for variants.
- Interactive elements use `cursor-pointer`; disabled ones use `cursor-not-allowed`.

### Comments

Default to none. A comment is one line stating a hidden constraint, an upstream workaround, a non-obvious invariant, or a cross-system quirk, and survives only if an agent would otherwise break behavior. Never restate names, narrate code, reference current work or PRs, add banners, leave a `TODO` without `TODO(handle): reason`, or write multi-line prose. Keep tooling directives and generated or license headers.
