# Guest lists go a set number of months after their event

A digital invitation's guest list holds other people's data: families' names, phones and emails, who of them comes, and allergies, which can reveal health (docs/adr/0012). Jolene keeps it for the couple only while it's of use, and the privacy policy says for how long. Marius chose 12 to 24 months after the event, set by Jolene's team rather than by each couple.

- **The workshop sets the months**, at `/studio/atelier/setari`: from 12 to 24, and 12 until someone saves another number. One `settings` document holds them, with who saved them last. The range is `GUEST_LIST_MONTHS` in `convex/workshop/settings.ts`, and the privacy policy promises it, so the policy changes before the range does.
- **The event's date counts.** A list is kept until that many months after it, and goes the next day, in Romania's time. An event without a date, or with one from before its invitation was made, such as a year typed wrong, counts from the latest the couple changed the invitation, added a family or took a reply.
- **A daily job deletes them** (`convex/invites/forget.ts`). It reads the invitations a hundred at a time and deletes each list that's due in runs of its own, a thousand documents each: every reply in its history, then each family's invitation emails and the family. Each run checks again first, so a date moved later in between keeps the list.
- **The invitation stays.** Its design, address, questions and unlock are the couple's, as are their event and designs. Its open link closes, so no one adds a family to it by the link. A family the couple adds afterwards goes with the next day's job, while the event is past its time.
- **Copies of sent emails go after 30 days.** Resend's component keeps each email it sent in Convex: sign-in codes, order confirmations and invitations, with guests' addresses. Another daily job deletes them 30 days on, by when what Resend said of an invitation's email is on its family.

## Consequences

- No guest list outlives what the privacy policy says: 24 months after the event at most, or after the invitation's last change for an event without a date.
- Couples aren't warned before their list goes. A reminder email a month before would be a feature of its own.
- Lowering the months deletes the lists it makes due at the next daily run, with no undo; raising them keeps only the lists not yet deleted.
- Orders stay 10 years, as accounting law requires; they don't hold guests.
- Resend's own service keeps its logs of the emails it sent under its own terms, outside Convex.
