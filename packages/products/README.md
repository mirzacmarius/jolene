# Products

jolene.ro's catalog, lifted from its WooCommerce shop: 456 products with their photos, prices, categories, order options, minimum orders and fees. `catalog/` holds it as lifted, and the studio's seed (`bun run seed` in `packages/backend`) loads it into Convex on every build, where the shop reads it ([ADR 0015](../../docs/adr/0015-jolene-sells-through-its-own-checkout.md)). The seed brings in the catalog's changes, except to products Jolene's team has changed in Convex, and takes off sale a product the catalog drops that nobody has changed.

## Lifting

```sh
bun run lift [folder]
```

reads jolene.ro's WooCommerce shop as pulled on 19 October 2026 (`products.json`, `categories.json` and `image-labels.json`, by default in `/mnt/project-files/jolene-catalog`) and writes `catalog/products.json`, `line-options.json` and `categories.json`. It writes titles in sentence case with their diacritics, keeps only the descriptions' formatting, picks each photo's original, or WordPress's 2560 px copy when the original is over 20 MB, 5000 pixels a side or 25 megapixels, reads each product's minimum order and fees from its description, and turns each product's options into either papers or order options (below). A label or choice it doesn't know stops it, so a new one is spelled in `src/lift/fields.ts` first.

## Blog

```sh
bun run blog
```

reads jolene.ro's 48 blog posts from its WordPress REST API and writes `blog/posts.json`: each post's title, dates, description and featured photo, and its text as blocks (paragraphs, headings, lists, quotes, photos, tables, videos), without WordPress's markup. It finds each photo at its largest on jolene.ro and measures it, links a post's mentions of products, categories and other posts to their pages in the shop, and leaves as text the links to pages the shop doesn't have. The shop shows each post at the address it had on jolene.ro, `/<slug>`, and lists them at `/blog`. The lift and the photo copy both need jolene.ro to still serve WordPress.

## Photos

The catalog keeps each photo's address on jolene.ro, and the photo store, a Vercel Blob store that every deployment shares, keeps a copy of each under the same path ([ADR 0016](../../docs/adr/0016-product-photos-live-in-one-vercel-blob-store.md)): `jolene.ro/2021/10/a.jpg`, at most 2048 pixels a side.

```sh
bun run photos [--to folder] [--minutes n]
```

copies from jolene.ro the catalog's and the blog's photos the store lacks, as the shop's production builds do after building, with the store's token in `BLOB_READ_WRITE_TOKEN`. `--to` writes the copies to a folder instead, to look at them, and `--minutes` stops starting copies after so long. `photoStore` in `src/photos.ts` holds the store's address, so the seed shows each product's photos from there.

## How the catalog sells

- **Paper is a product's option**, as are a favour's colour or a bauble's size: each value adds its surcharge to the price.
- **Every other order option is shared**: products asking the same, with the same choices and prices, list the same one, so a price changed once changes for all of them. Each option's `key` says what it asks, such as `culoare-sigiliu`, the same for every option asking it, so the shop can fill it in from a design.
- **Paid choices add to the line's price**, for each one ordered.
- **Fees are paid once an order**: `diacritice-50`, `diacritice-10` and `comanda-urgenta`. A product lists the ones it can carry.
- **A minimum order** is `minQuantity`, which the cart holds a line to.
- **Categories** are jolene.ro's that have products.
- **Handles are jolene.ro's addresses**, with underscores as hyphens, so the shop redirects `/produs/<name>/` to `/products/<name>`.

`src/digital-invitation.ts` is the digital invitation, a product of its own that the seed adds to the catalog without listing it: it's sold for one event at a time, from the studio (ADR 0014).
