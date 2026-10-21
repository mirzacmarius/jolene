# Product photos live in one Vercel Blob store

The shop's 1,427 product photos still load from jolene.ro, which closes when its domain moves to the shop (ADR 0015). They move to the photo store: one public Vercel Blob store, connected to the shop's Vercel project, which production, every preview and every developer's deployment show the same copies from. This replaces ADR 0015's plan to copy them into Convex storage.

Convex storage belongs to one deployment. Production could keep copies, but every preview and every developer's deployment would need its own, or show none once jolene.ro has gone: the reason the collections' artwork ships with the studio (ADR 0005). The photos are too big for the repository, 1.0 GB as jolene.ro has them and 320 MB fit for the web, so they go to one store that every deployment reads, at Vercel, which already serves the shop and optimizes its images.

- **A photo keeps its path.** `https://jolene.ro/wp-content/uploads/2021/10/a.jpg` is `jolene.ro/2021/10/a.jpg` in the store. The catalog in `packages/products` keeps jolene.ro's addresses, and the seed shows each photo from its copy (`src/photos.ts`). A path never takes another photo, since a changed photo gets a new name, so copies are cached for a year.
- **Copies are fit for the web**: at most 2048 pixels a side, turned upright, in sRGB and without the camera's metadata, in the photo's own format. The shop's pages ask Vercel's image optimizer for 1320 or 1920 pixels, and links shared from the shop show the copy itself.
- **The shop's production builds copy** the photos the store lacks from jolene.ro, for a quarter of an hour at most, after building (`scripts/photos.ts`); a copy that fails waits for the next production build and never stops a release. They reach the store with the token Vercel gave the shop's project when the store was connected to it, which nobody copies anywhere else.
- **The shop switches to the copies all at once**, when `photoStore` in `src/photos.ts` gets the store's address, once every photo is in the store. Until then it shows jolene.ro's.

## Consequences

- Vercel Pro includes 5 GB of Blob storage and 100 GB of its transfer a month, and the copies take 0.32 GB, so the store costs nothing while the team stays within them; past them, storage is $0.023 a GB a month. Vercel's image optimizer reads each copy once for each size it makes, then serves its own.
- Previews and developers' deployments show the same photos as production, without copying or holding the token.
- The shop's `images.remotePatterns` names the store's host. jolene.ro's goes when jolene.ro closes.
- Every photo has to be in the store before jolene.ro closes: a photo the catalog adds later is copied by the next production build while jolene.ro still serves it.
- The store keeps only the web copies; the originals stay with Jolene.
- A photo put in Convex storage (a product photo's `storageId`) still shows from there.
