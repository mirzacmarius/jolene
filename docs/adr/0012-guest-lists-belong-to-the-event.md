# Guest lists and replies belong to the event, and guests reply without an account

An event's digital invitation (`invites`) is the page guests open on their phone: the couple's invitation design, the day's programme from the event's details, and a reply form. The couple publishes one of the event's invitation designs to it; guests see a copy of the design document made at publishing, with the event's details as they are now, so a corrected date shows at once and an unfinished design doesn't. There is still one design document (docs/adr/0002): the copy is that document, frozen.

The guest list is the event's, not a design's: a family (`households`) is the people one invitation goes to, invited as a number of seats, perhaps with a plus-one, and they reply together, each person coming with their meal from the menus the couple offers, and allergies when the couple asks. Every reply is also kept in `replies`, for the couple's history; the couple can take a reply themselves for a family who phoned.

Guests never sign in. A family opens the invitation by their own link, the invitation's address and their code (eight letters and digits from an alphabet without look-alikes, about 850 billion possibilities), which knows how many of them are invited. Once the invitation is unlocked (docs/adr/0014), its address alone is its open link, for a group chat: whoever replies there adds their family to the list. The couple can close it. Replies stop after the day the couple set as the reply date, at midnight in Romania.

## Consequences

- Only an account manages a guest list (docs/adr/0011): an anonymous session ends with the browser's storage, and the replies with it.
- Anyone with a family's link can read the invitation and change that family's reply, as with an unlisted link. Rate limits keep a link from being used to flood the list.
- Guests' names, phone numbers and emails, their replies and allergies (which can reveal health) are personal data the couple collects and Jolene keeps for them in Convex. Allergies are asked only when the couple chooses and are seen only by the couple and the family, and Jolene's privacy policy must cover all of it.
- Families are capped at 600 an invitation and 12 seats a family, menus at six.
