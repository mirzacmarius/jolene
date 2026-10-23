# A couple shows a design by a viewing link

A couple rarely decides on an invitation alone: parents, siblings and friends are asked before anything is ordered. Until now the only way to show a design was a screenshot, or the proof's picture once ordered. The studio now gives every design a viewing link the couple turns on and off: whoever has it sees the design as the studio shows it, lifelike and from every side, with the couple's details, live as the couple keeps changing it, and can change nothing.

- **A link per design, by a code.** The design keeps its link's code (`designs.viewCode`, 12 letters and digits from the same alphabet as a partner's link), so the link is `/studio/vizionare/<code>` on the studio's own address. Turning the link off clears the code; on again makes a new one, so a link once passed around can be retired. The page reads the design through `designs.view`, a public query by the code: no account, no sign-in.
- **The details the design reads, no more.** The query sends the couple's details only as far as the document's words read them (and the names behind a monogram), never the whole event: a menu's link doesn't carry the RSVP phone. The hosts' names go with it, for the page's title and the link's preview. The couple's own files, such as their photos, show: the couple chose who sees the design.
- **A picture for the preview.** WhatsApp and the like show a link with a picture, so the browser that turned the link on draws the design (the same picture a proof keeps) and stores it through `designs.attachViewImage`, again whenever the design changed since. The page's metadata names the item, the collection and the couple, with that picture, and asks search engines not to index it.
- **Shown, not sold.** The page offers nothing of the couple's to change or order; it ends with an invitation to make one's own, the way the best design tools grow.
- **While the site has a password.** The page is a studio page, so it asks for the site's password like every other until launch (docs/adr/0022); the couple's parents need the password until then.

## Consequences

- A link is as private as whoever holds it keeps it; the couple's remedy is to turn it off, which the studio offers beside the link.
- The picture is drawn by the couple's browser, so a link turned on and never opened again in the studio shows its first picture until the next visit; the page itself is always live.
- Guests' digital invitations (docs/adr/0013) stay a different thing: an invitation is published on purpose and keeps the version guests see, while a viewing link shows the working design as it is.
