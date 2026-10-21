# Products

jolene.ro's catalog, moving from WooCommerce to the Shopify store: 456 products with their photos, prices, categories, order options, minimum orders and fees. `catalog/` holds it as lifted from jolene.ro, and the sync puts it in the store. From then on Shopify's admin is where it changes; the sync only adds what the store lacks, unless it's told to overwrite.

## Lifting

```sh
bun run lift [folder]
```

reads jolene.ro's WooCommerce shop as pulled on 19 October 2026 (`products.json`, `categories.json` and `image-labels.json`, by default in `/mnt/project-files/jolene-catalog`) and writes `catalog/products.json`, `line-options.json` and `categories.json`. It writes titles in sentence case with their diacritics, keeps only the descriptions' formatting, picks the photo Shopify takes (the original, or WordPress's 2560 px copy when the original is too big), reads each product's minimum order and fees from its description, and turns each product's options into either Shopify options or order options (below). A label or choice it doesn't know stops it, so a new one is spelled in `src/lift/fields.ts` first.

## How the catalog sits in Shopify

- **Paper is a Shopify option**, as are a favour's colour or a bauble's size: a variant for each combination, priced with the values' surcharges.
- **Every other order option is a metaobject** (`jolene_line_option`), with its choices as `jolene_choice` metaobjects priced per one ordered. Products asking the same, with the same choices and prices, share one, so a price Jolene changes in the admin (Content > Metaobjects) changes for all of them. A product lists its own in the `jolene.line_options` metafield, in order. Each option's `key` says what it asks, such as `culoare-sigiliu`, the same for every option asking it, so the shop can fill it in from a design.
- **Paid choices are charged on a line of their own**, of the unlisted product `optiuni-suplimentare`, whose variants cost 0.10 to 20.00 lei in steps of 0.10: the shop adds the variant the line's choices add up to, at the line's quantity. Shopify can only price a line's own options with Functions, which a store can run from its own app on the Plus plan alone.
- **Fees are products of their own**, unlisted: `diacritice` (50 or 10 lei) and `comanda-urgenta` (200 lei). A product lists the ones it can carry in `jolene.fees`, and the shop adds them once to the order.
- **A minimum order** is `jolene.min_quantity`, which the shop keeps the cart to.
- **Categories are collections**, one for each of jolene.ro's that has products.
- **Handles are jolene.ro's addresses**, with underscores as hyphens, so `/produs/<name>/` redirects to `/products/<name>`.

## Syncing

The store is reached through a Dev Dashboard app installed on it, with the scopes `write_products`, `write_publications`, `write_metaobjects`, `write_metaobject_definitions` and `read_orders`. Its client ID and secret are the repository's Actions secrets `SHOPIFY_CLIENT_ID` and `SHOPIFY_CLIENT_SECRET`, and the store's address the variable `SHOPIFY_STORE_DOMAIN`, unless a run's `store` names another, such as a test store. The app gets a day's access token from them on each run.

The **Products** workflow (`.github/workflows/products.yml`) runs `scripts/sync.ts`:

- **plan** checks each call the sync would make against the Admin API's 2026-10 schema (from `@shopify/dev-mcp`), then reads the store and reports what it already has. Every pull request that changes this package runs one.
- **draft** creates what the store lacks: the definitions, choices, order options, collections, the fee and extras products, and every product as a draft, with its photos fetched by Shopify from jolene.ro. It adds the products to the shop's sales channel, where they stay hidden while they are drafts, and reports the photos Shopify couldn't fetch.
- **publish** then puts the drafts on sale, the fees and extras unlisted, and adds the collections to the sales channel. A product Jolene archived stays archived.

`overwrite` updates what the store already has from the catalog too; a product keeps its photos and status. The sales channel is Vercel Storefronts, which Vercel's Shopify integration made the shop's (Headless on a store it didn't make), unless `publication` names another.

To run it elsewhere:

```sh
bun scripts/sync.ts plan --schema admin_2026-10.json.gz
```

with the schema from `npm pack @shopify/dev-mcp@1.17.0` (`package/dist/data/`). Without the three variables, a plan only checks its calls.

## Trying an order

The **Try an order** workflow (`.github/workflows/try-order.yml`) runs `scripts/try-order.ts` against the live shop, as a couple would and without paying: a product with its first paper, a paid order option and the answers it asks for, its fee, and its minimum order, through the cart to Shopify's checkout. It checks that the cart adds the extras and fee lines by itself and that checkout shows them. The run's summary says what each step showed, and its `order` artifact holds a screenshot of each. A store behind a password, as Shopify's dev stores always are, asks for it before checkout: the repository's Actions secret `SHOPIFY_STORE_PASSWORD` gives it (`SHOPIFY_STORE_PASSWORD` in the environment, run locally). Start it from the Actions tab with another product or shop address, or locally with Chrome or a Chromium:

```sh
bun run try-order --product invitatie-nunta-olive-goldy --chrome /path/to/chromium
```
