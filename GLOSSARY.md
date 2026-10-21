# Jolene

Jolene sells wedding and christening stationery that couples design themselves in the studio and Jolene's workshop prints, assembles and ships. Each term gives the word visitors read in Romanian and English, then the name in code where it differs.

## Language

### The catalog

**Collection** (ro: colecție; code: suite):
A family of designs that share artwork, palette and type: the invitation and everything that goes with it, such as the save the date, menu and place cards.
_Avoid_: Set, line, theme (in code, "theme" is a design's palette and type)

**Template** (ro: șablon):
One of Jolene's designs for one item of a collection, which a couple starts their own design from. Visitors never see the word; they see the item.
_Avoid_: Model, product (the product is what the shop sells)

**Item** (code: product kind):
What a design makes: an invitation (ro: invitație), save the date, RSVP card (card de confirmare), menu (meniu), place card, table number (număr de masă), welcome sign (tablou de întâmpinare), seating chart (tablou de așezare), money envelope (plic de bani), favour tag (etichetă pentru mărturii), thank-you card (card de mulțumire) or bridesmaid and groomsman card.
_Avoid_: Product, piece (a piece is one sheet of an item)

**Occasion** (ro: ocazie):
What the stationery is for: a wedding (nuntă) or a christening (botez).
_Avoid_: Event type, category

**Photo store** (code only):
The public Vercel Blob store the shop shows product photos from, which production and every preview share. Photos from jolene.ro keep their path there.
_Avoid_: Bucket, CDN, media library

### Designing

**Design** (ro: design):
A couple's own copy of a template, which they change in the studio and order. It belongs to one event.
_Avoid_: Project, draft, customization

**Event** (ro: eveniment):
A couple's wedding or christening as the studio knows it: the details every one of their designs shares, so the names typed on the invitation are already on the menu.
_Avoid_: Order, party

**Details** (ro: detalii; code: fields):
What a couple writes once for an event: their names, the date, the church and venue, the godparents, the RSVP date. Empty details show an example in the preview.
_Avoid_: Text, data, info

**Godparents** (ro: nași):
The couple who sponsor a Romanian wedding or christening and are named on its invitation.
_Avoid_: Sponsors, witnesses

**Piece** (ro: piesă):
One sheet of paper in an item, with its role: the card, a vellum band or overlay, a pocket, an insert or a tag. An item is often a single piece.
_Avoid_: Page, layer, part

**Face** (ro: față, verso; en: front, back):
One side of a piece, front or back, holding its layers.
_Avoid_: Page, side (in code)

**Assembly** (ro: ansamblu; en: together):
An item shown as it arrives: its pieces stacked in place, with the seal, ribbon or envelope on top.
_Avoid_: Mockup, composite

**Lifelike preview** (ro: realist; code: lifelike) / **Flat** (ro: plat):
The two ways the studio shows a design. Lifelike is a photograph of the printed suite on a table: the paper's grain and thickness, foil catching the light, vellum, the seal and the envelope. Flat is the design exactly as it prints, for checking alignment; proofs and print files are always flat.
_Avoid_: 3D, mockup, render

**Palette** (ro: culori, paletă):
A design's five colours: ink for text, accent for the names, muted for small print, paper, and art for the illustrations.
_Avoid_: Theme, colour scheme

**Simple mode** / **Expert mode** (ro: modul simplu / modul expert):
The two ways to design: simple mode changes details, palette, paper and finishes in a click; expert mode moves and edits every layer on the canvas.
_Avoid_: Basic, advanced, pro

**AI designer** (ro: designer AI):
The studio's co-designer, which changes a design by the same operations a person makes.
_Avoid_: Bot, assistant, chat

**Wording** (ro: textul):
The words of an item around the couple's details: the invitation's opening lines, a verse, the closing. In simple mode the AI designer writes the wording of each item the couple chose, the invitation first, in the language and tone they chose.
_Avoid_: Copy, content, text (in code, a text layer's words)

**Tone** (ro: ton):
How the wording sounds: classic, romantic, or modern and short for a wedding; classic, tender or playful for a christening. It stays on the event with the cards' language and any line of the couple's own.
_Avoid_: Style (a collection's look), voice, mood

**Composition** (code only):
Simple mode's request that the AI designer write several items of a collection: one reply in each item's conversation, the invitation's first and the others after it, in its voice.
_Avoid_: Batch, job

### Paper and finishes

**Paper** (ro: hârtie, carton; code: stock):
The sheet a piece is printed on, such as cotton paper 350 g or pearlescent card 250 g.
_Avoid_: Material, cardstock (in UI)

**Vellum** (ro: foaie de calc):
Translucent paper, laid over or wrapped around a card.
_Avoid_: Tracing paper, transparent paper

**Foil** (ro: folio):
Metallic finish pressed onto paper: gold (auriu), rose gold, silver (argintiu) or copper (cupru). Each foil is its own plate in the print file.
_Avoid_: Gilding, metallic print

**Ink** (code: ink):
How a layer reaches paper: printed in colour, white ink, a foil, embossing, debossing or spot UV.
_Avoid_: Finish (for one layer), colour

**Wax seal** (ro: sigiliu din ceară):
A seal of coloured wax pressed with the couple's initials or a motif, fixed on the assembled item.
_Avoid_: Stamp, sticker

**Envelope liner** (ro: căptușeală plic):
The printed paper lining the inside of an envelope.
_Avoid_: Insert

**Trim lines** (ro: margini de tăiere):
The guides the studio draws over a face: where the workshop cuts the piece, and the bleed beyond, printed and then cut away so colour runs to the edge.
_Avoid_: Border, padding, crop marks

### Printing

**Print file** (ro: fișier de tipar):
The PDF the workshop prints an item from: every face of every piece, a page for each plate, with its bleed, crop marks and a line saying what each page is. Couples never get one; they approve a proof.
_Avoid_: Export, artwork, PDF (any PDF)

**Plate** (ro: separație):
One ink's page of a face in the print file: the colour print, or the shape in solid black where the workshop presses a foil, white ink, embossing or spot UV.
_Avoid_: Layer, separation (in code)

**Crop marks** (ro: semne de tăiere):
The short lines outside each corner of a page in the print file, where the workshop cuts, and the dashed fold marks where a piece folds.
_Avoid_: Trim lines (the studio's guides on screen)

**Die line** (ro: contur de tăiere):
The outline a die cuts a piece to when it isn't a plain rectangle, on its own page after the piece's faces.
_Avoid_: Cut path, shape

**Safe margin** (ro: margine de siguranță):
The band inside the trim that words stay out of, so a cut a little off never touches them.
_Avoid_: Padding, quiet zone

### Ordering

**Proof** (ro: bun de tipar):
The final version of a design a couple approves before Jolene prints it.
_Avoid_: Preview (any view in the studio), draft

**Favours** (ro: mărturii):
Small keepsakes given to guests, sold in the shop alongside the stationery.
_Avoid_: Gifts, souvenirs

**Category** (ro: categorie):
A shelf of the shop, such as Invitații nuntă or Mărturii, as jolene.ro had them. Its address in the shop still says `/collections/`, as the template had it.
_Avoid_: Collection (a family of designs)

**Order option** (ro: opțiune; code: line option):
What a couple chooses or writes when they order a product, apart from its paper: the seal's colour, the ribbon, the envelope, a text. It travels with the line in the cart, and products that ask the same share one.
_Avoid_: Add-on, customization, attribute

**Extras** (ro: opțiuni suplimentare):
What a line's paid order options add to each one ordered, in the line's price.
_Avoid_: Add-ons, upsell

**Minimum order** (ro: comandă minimă; code: minQuantity):
The smallest quantity of a product Jolene takes an order for, such as 30 invitations.
_Avoid_: MOQ

**Fee** (ro: taxă):
A one-off charge on an order, such as for diacritics or an urgent order, paid once however many lines ask for it.
_Avoid_: Surcharge (what a paper adds to a product's price)

**Checkout** (ro: plată):
Paying for the cart on Stripe's page. Convex keeps the cart as it was priced when the couple went to pay, and their order is made from it.
_Avoid_: Payment page

**Delivery** (ro: livrare):
How a printed order reaches the couple, and what that costs, chosen on Stripe's page: by courier or by pickup.
_Avoid_: Shipping (in copy)

**Courier** (ro: curier; code: cargus):
Delivery to the couple's door by Cargus: 25 lei, and nothing from 800 lei.
_Avoid_: Carrier, shipping

**Pickup** (ro: ridicare de la atelier; code: pickup):
Delivery by the couple picking their order up from the workshop in Iași, for nothing. Stripe's page asks for their address all the same.
_Avoid_: Collection (a family of designs)

**VAT** (ro: TVA; code: vat):
The value added tax inside the shop's prices. Jolene's prices include it, so Stripe Tax shows how much of what the couple paid is VAT, and never adds to it.
_Avoid_: Tax (in Romanian, taxă is a fee)

**Invoice** (ro: factură):
The fiscal document of a paid order, made out to whoever paid or the company they bought as, which Jolene's invoicing tool sends to e-Factura.
_Avoid_: Receipt (a fiscal receipt, bon fiscal, is another document)

**Billing details** (ro: date de facturare; code: billing):
Who an order's invoice is for, as Stripe's page took them: the payer's name and billing address and, for a company, its name and tax code (CUI).
_Avoid_: Customer (who paid, to email), billing info

**Order** (ro: comandă):
What a couple paid for in one checkout: its lines and fees as they were priced, its delivery, where it goes and what Stripe charged.
_Avoid_: Purchase, sale

**Order number** (ro: numărul comenzii; code: number):
What the couple and the workshop call an order: J and a number from 1001, such as J1001.
_Avoid_: Order id (an order's key in Convex)

**Order page** (ro: pagina comenzii):
The shop's page of one order, at a long random address that the couple's emails link to.
_Avoid_: Receipt, order status

**Order status** (ro: stadiul comenzii; code: status):
Where an order is between paid and in the couple's hands: paid (plătită), being made (în lucru), sent (expediată) by courier or ready to pick up (gata de ridicat), then complete (finalizată), which the couple's page calls delivered (livrată) or picked up (ridicată); or cancelled (anulată). The workshop moves it on. An order with nothing to deliver, such as a digital invitation alone, is complete once it's paid.
_Avoid_: State, stage, fulfilment, shipped (in copy)

**Note** (ro: notă; code: note):
What the workshop writes on an order for the rest of the team, such as what the couple said on the phone. The couple never sees it. It sits in the order's history (ro: istoric; code: orderHistory) beside each change of status, with who wrote it and when.
_Avoid_: Comment, memo

**Refund** (ro: rambursare; code: refund):
Money Stripe gives back from an order's payment to the card that paid, all of it or a part: from the order's page in the workshop, or from Stripe's dashboard. It's pending (în curs) until it reaches the card's bank, and can fail (eșuată). It changes nothing else about the order.
_Avoid_: Reimbursement, return (sending products back), chargeback (a dispute the bank opens)

**Test order** (ro: comandă de test; code: test):
An order paid in Stripe's test mode, with a test card: a trial, not a sale.
_Avoid_: Sandbox order

**Workshop** (ro: atelier):
Jolene's team, who print, assemble and send what couples order, and their pages in the studio, where they see every paid order, make its print files, move it on and refund it.
_Avoid_: Admin, back office, staff

### Digital invitations

**Digital invitation** (ro: invitație digitală; code: invite):
An event's invitation sent by link: the page guests open on their phone, with the couple's invitation, the day's programme and the reply form.
_Avoid_: E-invite, website, RSVP page

**Publish** (ro: publicați):
To make one of the event's invitation designs the one guests see. Later changes show once the couple publishes again.
_Avoid_: Share, send

**Unlock** (ro: deblocați; code: unlocked):
To open a digital invitation to every family on the list, by buying it in the shop, with the event's printed invitations, or by Jolene's team by hand. Before that it is **on trial** (ro: de probă): only the first three families can open it.
_Avoid_: Activate, upgrade

**Unlock right away** (ro: deblocare imediată; code: unlockNow):
The couple's agreement, ticked in the cart before they pay for a digital invitation, that their order unlocks it as soon as it's paid, which ends their 14 days to withdraw from it. One that comes free asks for none.
_Avoid_: Waiver, consent

**Account** (ro: cont):
What a couple signs in to with a code sent to their email, to keep a guest list and share their event. Designing needs none.
_Avoid_: Profile, login

**Partner** (ro: partener):
The other half of the couple, who joins an event from their own account by the owner's link and manages its digital invitation with them.
_Avoid_: Collaborator, co-owner

**Family** (ro: familie; code: household):
The people one invitation goes to, such as a couple, a family with children or one friend. They open it by their own link and reply together.
_Avoid_: Party, group, household (in copy)

**People** (ro: persoane; code: seats):
How many of a family are invited, children included.
_Avoid_: Seats (in copy), headcount

**Plus-one** (ro: însoțitor; code: plusOne):
Someone a family may bring who isn't on the list.
_Avoid_: Guest of a guest

**Whose guests** (ro: invitații cui; code: side):
Which of the couple invited a family, or both.
_Avoid_: Side (in copy)

**Personal link** (ro: link personal) / **Open link**:
A family's own link, the invitation's address and their code, knows who they are. The address alone is the open link, which anyone can reply by, adding their family to the list; the couple can turn it off.
_Avoid_: URL, code (only the end of the link)

**Reply** (ro: confirmare; code: reply):
A family's answer: who of them is coming, each with their meal, or that they can't. The couple can take one for a family who phoned.
_Avoid_: RSVP (the printed card)

**Guest** (ro: invitat):
One person on a family's reply.
_Avoid_: Attendee

**Meal** (ro: meniu; code: meal):
What a guest chooses to eat, from those the couple offers.
_Avoid_: Menu in code (the printed item)
