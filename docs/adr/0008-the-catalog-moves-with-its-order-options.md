# jolene.ro's catalog moves to Shopify with its order options

Its Shopify parts are superseded by [ADR 0015](0015-jolene-sells-through-its-own-checkout.md): the catalog lives in Convex, where a line costs its paper plus its paid choices. Order options, fees and minimum orders keep their meaning.

jolene.ro sells 456 products, and 407 of them ask the couple for more than a quantity: the paper, the seal's colour, the edges, the ribbon, the envelope, preserved flowers, a text. Most of these choices add a price to each one ordered. Shopify allows a product 3 options and 2,048 variants, so only 283 products would fit if every paid choice were an option, and the folded invitations alone would need 29,040 variants. It can price a line's own options only with Functions, which a store runs from its own app on the Plus plan alone.

So the catalog moves in four parts (`packages/products`):

- **Paper stays a Shopify option**, as do a favour's colour and a bauble's size. They change what Jolene makes, and an option shows in checkout, emails and the admin.
- **Every other order option is a metaobject**, with its choices and their prices, and products that ask the same share it. The shop asks them, and the cart line carries the answers as attributes.
- **Paid choices are charged on a line of their own**, of a product whose variants cost 0.10 to 20.00 lei, at the line's quantity.
- **Fees are products of their own**, added once to an order: diacritics and urgent orders. **Minimum orders** are a product metafield the shop keeps the cart to.

The catalog is lifted from jolene.ro into the repository and put in the store by a GitHub Actions workflow, through a Dev Dashboard app the store installed: drafts first, for Jolene to check, then on sale. Shopify's admin owns it from then on, so the sync only adds what the store lacks unless told to overwrite. Products keep the names of their jolene.ro addresses as handles, so `/produs/<name>/` redirects to `/products/<name>`.

## Consequences

- Jolene changes an option's prices once, in the admin, for every product sharing it. A product that should cost differently needs an option of its own.
- The shop picks the extras line's variant, so a crafted cart can pay less for its choices than they cost. Every order goes through a proof, and the workshop's order list checks each extras line against its choices.
- Checkout can't hold an order to its minimum without Plus; the shop's cart does.
- The order confirmation email lists each line's attributes only once its template is changed to.
- The app's credentials live in the repository's Actions secrets and give a day's token per run. The workshop's order list reads orders with the same app (`read_orders`).
- Re-lifting from jolene.ro rewrites `catalog/`, not the store.
