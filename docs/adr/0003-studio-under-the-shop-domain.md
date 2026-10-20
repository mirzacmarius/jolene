# The studio runs under the shop's domain, without an account

The studio is its own Next.js app (`apps/studio`), deployed on its own, and serves `jolene.ro/studio` (routed there by Vercel Microfrontends, docs/adr/0004). Couples move between the collections, the designer and checkout on one domain, and each app deploys and fails on its own.

Designing needs no account. The first time a visitor starts a design, the studio signs them in anonymously with Convex Auth and keeps the session in the browser, so their designs come back on their next visit from that browser. The studio renders without knowing who is signed in, so every page has a static shell; signed-in data loads in the browser.

## Consequences

- Links from the shop into the studio are plain anchors, so the browser loads the other app.
- A design started on one device isn't on another until the visitor signs in with an account, which comes with ordering.
