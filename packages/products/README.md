# Products

jolene.ro's catalog, lifted from its WooCommerce shop: 456 products with their photos, prices, categories, order options, minimum orders and fees. `catalog/` holds it as lifted, and the studio's seed (`bun run seed` in `packages/backend`) loads it into Convex on every build, where the shop reads it ([ADR 0015](../../docs/adr/0015-jolene-sells-through-its-own-checkout.md)). The seed brings in the catalog's changes, except to products Jolene's team has changed in Convex, and takes off sale a product the catalog drops that nobody has changed.

## Lifting

```sh
bun run lift [folder]
```

reads jolene.ro's WooCommerce shop as pulled on 19 October 2026 (`products.json`, `categories.json` and `image-labels.json`, by default in `/mnt/project-files/jolene-catalog`) and writes `catalog/products.json`, `line-options.json` and `categories.json`. It writes titles in sentence case with their diacritics, keeps only the descriptions' formatting, picks each photo's original, or WordPress's 2560 px copy when the original is over 20 MB, 5000 pixels a side or 25 megapixels, reads each product's minimum order and fees from its description, and turns each product's options into either papers or order options (below). A label or choice it doesn't know stops it, so a new one is spelled in `src/lift/fields.ts` first.

## How the catalog sells

- **Paper is a product's option**, as are a favour's colour or a bauble's size: each value adds its surcharge to the price.
- **Every other order option is shared**: products asking the same, with the same choices and prices, list the same one, so a price changed once changes for all of them. Each option's `key` says what it asks, such as `culoare-sigiliu`, the same for every option asking it, so the shop can fill it in from a design.
- **Paid choices add to the line's price**, for each one ordered.
- **Fees are paid once an order**: `diacritice-50`, `diacritice-10` and `comanda-urgenta`. A product lists the ones it can carry.
- **A minimum order** is `minQuantity`, which the cart holds a line to.
- **Categories** are jolene.ro's that have products.
- **Handles are jolene.ro's addresses**, with underscores as hyphens, so the shop redirects `/produs/<name>/` to `/products/<name>`.

`src/digital-invitation.ts` is the digital invitation, a product of its own that the seed adds to the catalog without listing it: it's sold for one event at a time, from the studio (ADR 0014).
