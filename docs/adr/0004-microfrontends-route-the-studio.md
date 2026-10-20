# Vercel Microfrontends routes /studio to the studio

The shop and the studio are two Vercel projects in one microfrontends group, with the shop as its default app. `apps/shop/microfrontends.json` gives `/studio` and everything under it to the studio, and Vercel sends those requests to the studio's deployment before the shop sees them. The studio's files get a path prefix of their own, so the two apps' assets never collide.

The alternative, the shop rewriting `/studio` to the studio's own URL, reaches only a public deployment. Vercel's login protects previews, so a shop preview could never show the studio built from the same branch. Microfrontends routes previews as it routes the live site, and keeps the studio's address out of the shop's build.

Next.js `basePath` doesn't work with microfrontends, so the studio's routes live under `apps/studio/src/app/studio/` and its links carry `/studio` themselves.

## Consequences

- A preview of either project serves both apps on one address, built from the same branch.
- Locally, `turbo dev` starts the microfrontends proxy on port 3024, which serves both apps as jolene.ro does, and the apps' own ports redirect to it.
- The group lives in Vercel, not in this repository: a new app joins it in the team's Microfrontends settings and in `microfrontends.json`.
- Routed requests count against Vercel's microfrontends allowance: 50,000 a month on Hobby, billed by use on Pro, which the live shop needs anyway as a commercial site.
