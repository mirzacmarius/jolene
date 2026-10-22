# The workshop signs in with Google

The workshop's pages show customers' names, emails, phones and addresses, and give back their payments (docs/adr/0009). The team signed in to them as couples sign in to their accounts, with a code sent to the address (docs/adr/0011). It signs in with Google instead: with the Google account of an address on the workshop's list.

- **Convex Auth's Google provider**, with the web client of Jolene's Google Cloud project in `AUTH_GOOGLE_ID` and `AUTH_GOOGLE_SECRET` on the Convex deployment. An address counts only when Google says it verified it, and Google signs an address in to the account it already has, as a code did.
- **Google vouches for the workshop's addresses.** Once the deployment has the client, the pages open to an account whose address is in `WORKSHOP_EMAILS` only if it signed in with a Google account whose address, as Google verified it, is the account's (`requireWorkshop` in `convex/workshop/staff.ts`). A workshop address gets no emailed code then (`use-google`), so a code can't stand in for Google; the couples' sign-in form sends it to the workshop instead. A team member signed in with a code is asked to continue with Google.
- **The emailed code until then.** A deployment without the client signs the team in with a code, as before. Previews and local deployments always do, as Google calls back to the one Convex deployment its client lists (`/api/auth/callback/google`), and production does until its keys are set, so the team is never locked out.
- **Back where it set off.** Only the browser that set off for Google can take its answer, on the address it set off from. Convex Auth sends it back to that page when it's a studio page on the shop's address (`SHOP_URL`) or the studio's own (`SITE_URL`), and refuses anything else (`signInReturn` in `convex/workshop/google.ts`); on another address, the workshop's sign-in links to the shop's.

## Consequences

- Production needs a Google Cloud project with an OAuth consent screen and a web client whose authorized redirect URI is `https://<deployment>.convex.site/api/auth/callback/google`, its ID and secret on Convex production only. Removing either brings the codes back.
- Each address in `WORKSHOP_EMAILS` must be a Google account's: a Gmail or Google Workspace address, or one someone made a Google account with. Google asks it only for its address, name and picture.
- Once the keys are set, a team member signed in with a code still meets the workshop's sign-in, until they continue with Google.
- When jolene.ro serves the shop and `SHOP_URL` moves there, Google brings the team back there, and the workshop's sign-in elsewhere links there.
