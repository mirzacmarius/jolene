# A password keeps the site private until launch

Jolene isn't public yet: the shop at www.orvibo.it takes test payments, and its catalog and the studio are still changing. Marius asked on 2026-10-22 for the site to ask for a password until then. While `SITE_PASSWORD` is set, every page of the shop and the studio asks for it first.

- **One gate, in both apps' proxies.** `@jolene/gate` answers a request before anything renders. The shop's `proxy.ts` and the studio's ask it first, since microfrontends sends `/studio` to the studio before the shop sees the request (docs/adr/0004). Each reads `SITE_PASSWORD` from its own Vercel project, so both projects hold the same password.
- **A page, then a cookie.** A browser without the cookie gets a page asking for the password, in Romanian or English as the studio picks a visitor's language, answered 401, kept by no cache and indexed by no search engine. It posts the password back to the address it's on, and once it's right the browser goes on to that page with the `jolene-gate` cookie for 30 days. The cookie holds an HMAC keyed by the password, never the password, so changing the password shuts every browser out. The shop and the studio share one address, so one cookie opens both. A wrong password waits a second for its answer.
- **What stays open.** Guests' invitations at `/invitatie`, which Marius chose to keep open: guests can't know the password, and each page shows only its couple's invitation (docs/adr/0013). The routes the studio calls, which check their callers themselves: the shop's `/api` (a proof into the cart, the catalog's refresh) and the studio's `/studio/api` (print files). The studio's files under `/studio`, such as the collections' artwork the invitations show, and every app's static assets. Stripe's, Resend's and Colete Online's webhooks and Convex's crons are Convex's, on its own address, so the gate never meets them.
- **No search engine indexes it.** While the site has a password, `/robots.txt` disallows every path, and the page asking for it is `noindex`.
- **Our own gate, rather than Vercel's.** Vercel's Password Protection is an add-on to the Pro plan, at a monthly price of its own. Ours costs nothing, and opens to guests' invitations and the studio's calls by their paths.

## Consequences

- Marius sets `SITE_PASSWORD` on both Vercel projects (`jolene` and `jolene-studio`), Production only, to the same password. Vercel gives a deployment the variables it had when it was built, so a new or changed password takes a redeploy of both, and removing it from both and redeploying opens the site.
- Previews keep Vercel's login and ask for no password.
- Links that bring someone back to the site, such as an order email's or Stripe's return to the shop, ask for the password like any page while it's set: the orders are test orders until launch.
- A shared password is as strong as it is long, and anyone who has it can pass it on: changing it is how to shut someone out.
- Launching on jolene.ro takes removing it.
