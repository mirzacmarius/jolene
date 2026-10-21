# Couples sign in with a code sent to their email

Designing still needs no account (docs/adr/0003). A couple signs in when their work should outlive the browser: to keep a guest list and its replies, or to manage their event with their partner. They type their email, receive an eight-digit code from Jolene and type it back; there are no passwords to keep or reset. It is Convex Auth's email provider, with the codes sent through Resend (`@convex-dev/resend`), each one good for 15 minutes. Convex Auth allows ten wrong guesses an hour for each address, and a rate limiter sends an address a few codes an hour and everyone together a few hundred, so no one can mail the world through the studio.

What a couple made anonymously moves to their account as they sign in: Convex Auth calls `beforeSessionCreation` while the request still carries the anonymous session, and the events, designs, proofs, photos, simple mode's compositions and the AI designer's messages change owner in the same transaction (any beyond the first 200 just after it, a batch at a time). So the account holds the work from that browser, and signing in on another device brings it there.

Convex's React provider authenticates again only when someone signs in or out, not when one session replaces another, as the anonymous one does at sign-in. The studio restarts its provider when the session in the token changes, so the account's data shows without a reload.

A partner manages the event with its owner: the owner sends a link (`/studio/partener/<code>`), and a partner who opens it signed in joins the event. Partners see and change the digital invitation and its guest list, not the designs.

## Consequences

- Sign-in by email needs `RESEND_API_KEY` on the Convex deployment and a sending domain Resend has verified (`EMAIL_FROM`, by default `Jolene <salut@jolene.ro>`). Without the key the studio says signing in by email isn't set up yet. Locally, `AUTH_LOG_CODES=1` writes the codes to the Convex logs instead.
- A couple who designed on two devices before signing in gets the work of each as they sign in there.
- An email address is personal data, kept with the account in Convex; Jolene's privacy policy must say so.
