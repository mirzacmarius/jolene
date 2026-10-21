# SmartBill issues each paid order's invoice

Every sale needs an invoice, and Romania wants each one in e-Factura, sales to people included. Stripe takes the payment and works out the VAT in it (ADR 0015), but issues no Romanian invoice. Marius chose SmartBill to issue them: it numbers Jolene Design SRL's invoices, sends them to e-Factura and keeps them for the accountant. The shop asks it through its API (`convex/invoices.ts`, `convex/invoices/`) as soon as an order is paid.

- **One invoice for each paid order, issued once.** `orders.record` schedules `invoices.issue`, which issues the invoice in the series `SMARTBILL_SERIES`, dated the day it is in Romania. The order notes the invoice as being issued before SmartBill is asked, and as issued, with its series and number, as soon as SmartBill answers, so nothing asks for it twice.
- **It says what the couple paid for, as they paid it**: each line at its price with the VAT inside, at SmartBill's standard rate, its options as the line's description; the fees; the promotion code's discount, off what was bought; the courier; and the card payment that settled it. It's made out to the company the couple bought as, with its tax code, or to the payer, at the billing address the order keeps, a Bucharest address under its sector, as e-Factura wants it. Invoices are in Romanian, whichever language the couple paid in.
- **A test order's invoice is a draft**, which SmartBill neither numbers nor sends to e-Factura: SmartBill has no test mode, and a draft shows the team what a real one will look like. It gets no PDF or email.
- **SmartBill's PDF is kept** in Convex's storage. The order's page links to it, and the couple gets an email in their language that links to it through the shop (`/orders/<token>/invoice`), since Resend's component sends no attachments.
- **What goes wrong goes to the team.** A refusal is kept on the order with SmartBill's reason, and the team gets an email; the workshop asks SmartBill again with `invoices.retry`. When SmartBill didn't answer, it may have issued the invoice all the same, so the email says to look in SmartBill first. An issued invoice whose PDF couldn't be fetched, or whose total in SmartBill isn't what Stripe charged, stands, with a warning for the team.
- **A refund reverses the invoice in full**: the workshop's refund calls `creditInvoice`, and SmartBill issues the credit note in the invoice's series. It's kept, linked from the order's page, the same way.
- **Some orders are invoiced by hand**: those paid before Stripe's page asked for billing details, those of a company from outside Romania, which may need reverse charge, and any while SmartBill lists no VAT rate.

## Consequences

- A Convex deployment issues invoices once it has `SMARTBILL_USERNAME` (the account's email), `SMARTBILL_TOKEN` (its API token) and `SMARTBILL_SERIES`. `SMARTBILL_CIF` is Jolene Design SRL's tax code unless set. Until then each order says in the logs that it got no invoice, and the workshop can ask for one later.
- Production takes test payments until launch, so SmartBill gathers a draft for each test order there until then. Previews ask SmartBill only if they're given the same variables, which they don't need.
- SmartBill sends invoices to e-Factura once that's turned on in its settings, which is Jolene's to do in SmartBill.
- Each invoice takes SmartBill four calls (its VAT rates, the invoice, its PDF, its total); SmartBill refuses calls for ten minutes after 30 in ten seconds.
- SmartBill's API documentation couldn't be read from the sessions that wrote this, so the calls follow SmartBill's published PHP client and plugins. The first invoices in SmartBill are worth checking by eye: the discount line's sign above all.
- Partial refunds aren't reversed for now: the team issues their credit notes in SmartBill.
