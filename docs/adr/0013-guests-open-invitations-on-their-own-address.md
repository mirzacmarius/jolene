# Guests open invitations on their own address, served by the studio

The studio serves digital invitations at `/invitatie/<slug>` and a family's at `/invitatie/<slug>/<code>`. On their own address, `invitatie.jolene.ro`, the studio's proxy rewrites `/<slug>` and `/<slug>/<code>` to those pages, and the address's root sends visitors to Jolene. Convex keeps the address families' links are made with in `INVITE_URL`; until it is set, links use the studio's own `/invitatie`, so they work before the domain does.

A separate address, rather than a path the shop's microfrontends route (docs/adr/0004), keeps guests' links short and independent of where jolene.ro points: the address is a domain on the studio's Vercel project, and links sent today keep working when jolene.ro moves to the new shop.

The pages render on the server for every visit, since a link shared on WhatsApp is read by its preview bot before any guest: the preview shows who the invitation is from, for whom and when, with the studio's picture of the published card. They read Convex at request time (`io()` from `next/cache` before the first query, as Cache Components needs), then stay live in the browser, so a reply shows at once. A page speaks the invitation's language, or the one the family was given, or the one the guest picks, independently of the studio's.

## Consequences

- `invitatie.jolene.ro` needs a CNAME to Vercel and the domain on the `jolene-studio` project; then `INVITE_URL=https://invitatie.jolene.ro` on Convex production. Families' links change from the fallback to it, so it is best set before couples start sending.
- An invitation's slug can't be one of the studio's own paths (`studio`, `api`, `invitatie`, …).
- The studio's root on `invitatie.` hosts is not the studio: it redirects to jolene.ro.
