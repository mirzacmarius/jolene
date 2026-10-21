# Guests open invitations on their own address, served by the studio

The studio serves digital invitations at `/invitatie/<slug>` and a family's at `/invitatie/<slug>/<code>`, and `apps/shop/microfrontends.json` routes `/invitatie` to it as it routes `/studio` (docs/adr/0004), on every address of the group. Guests' links are short and on an address of their own: `invitatie.jolene.ro/<slug>/<code>`. Convex keeps the address families' links are made with in `INVITE_URL`; until it is set, links use `/invitatie` at `SITE_URL`'s address, so they work before the domain does.

The address is a domain of the shop's project, because Vercel routes every domain of a project in the group by the group's paths, the studio's own domains included: on them too, a path microfrontends doesn't route, such as `/ana-si-mihai`, is the shop's. So the shop answers the guests' address: its `next.config.ts` redirects `/<slug>` and `/<slug>/<code>` there to `/invitatie/…` on the same address, which the studio serves, and the address's root to jolene.ro. A rewrite would keep the short path in the address bar, but a rewrite stays inside the app that makes it; only microfrontends routing crosses to the studio.

A separate address, rather than links at jolene.ro/invitatie, keeps guests' links short and on Jolene's name while the shop's own address is still a temporary one: links sent today keep working when jolene.ro moves to the new shop.

The pages render on the server for every visit, since a link shared on WhatsApp is read by its preview bot before any guest: the preview shows who the invitation is from, for whom and when, with the studio's picture of the published card. They read Convex at request time (`io()` from `next/cache` before the first query, as Cache Components needs), then stay live in the browser, so a reply shows at once. A page speaks the invitation's language, or the one the family was given, or the one the guest picks, independently of the studio's.

## Consequences

- `invitatie.jolene.ro` needs a CNAME to Vercel and the domain on the shop's project (`jolene`); then `INVITE_URL=https://invitatie.jolene.ro` on Convex production. Families' links change from the fallback to it, so it is best set before couples start sending.
- A guest who opens a link sees `invitatie.jolene.ro/invitatie/<slug>/<code>` in the address bar after the redirect.
- An invitation's slug can't be a path microfrontends routes or the studio's own (`studio`, `invitatie`, `api`, `vc-ap-…`).
- On every other address of the group, the shop's included, `/invitatie/…` is the studio's.
