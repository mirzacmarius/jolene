# The workshop changes the shop's products

The catalog lives in Convex, where the studio's seed loads it from jolene.ro's lift, and a product edited in Convex keeps its edits (ADR 0015). Until now nothing edited one: a new price meant a change to `packages/products/catalog` and a deploy. Jolene's team now changes the shop's products in the studio, at `/studio/atelier/produse` (`convex/workshop/products.ts`).

- **What the team changes**: a product's name, its price, the price before a discount, its minimum order, what each of its papers adds, and whether it's for sale. Its description, photos, order options and categories stay as the seed loaded them for now. A product taken off sale leaves the shop and its categories, a cart that holds it says it's no longer available, and paid orders stay as they are.
- **A changed product is the team's.** Saving sets `editedAt` and `editedBy`, and the seed leaves the product as the team left it from then on. Saving with nothing changed leaves it the seed's.
- **Nobody overwrites a colleague's change.** The page saves against the version it showed (its `editedAt`); if someone saved the product since, nothing changes (`product-changed`) and the page shows their version. A page with nothing typed in it follows the product as it changes.
- **The shop shows a change on the next visit.** The shop caches what its pages read of the catalog for minutes, under tags (ADR 0015). Once a change is saved, the workshop's page posts the account's Convex token to the shop's `/api/catalog/refresh`, on the same address through the microfrontends group (ADR 0004); the shop asks Convex whether the token is a workshop account's and expires the `products` and `categories` tags. It needs no new secret.

## Consequences

- The refresh can fail, as on a preview, where the studio and the shop have addresses of their own. The page then says the shop shows the change within minutes, as long as its cache keeps the catalog.
- For a product the team has changed, Convex says what the shop sells, not `packages/products/catalog`: a change to it in the repository doesn't reach the shop.
- About 300 products' descriptions state their minimum order ("Comandă minimă: 30 buc."), so a new minimum leaves the old one in the description until descriptions can be changed in the workshop too.
