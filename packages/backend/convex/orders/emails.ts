import type { Doc, Id } from "../_generated/dataModel";
import { WORKSHOP_ADDRESS } from "../checkout/delivery";
import { escapeHtml } from "../emails";
import type { Unlock } from "../invites/validators";
import { lei, orderName } from "./format";
import type { Address } from "./validators";

/**
 * An order's emails, which Convex writes itself: the couple's confirmation,
 * in the language they paid in, and the notice to Jolene's team, in
 * Romanian. Romanian speaks to the couple in the plural, as the shop does.
 */

type Order = Doc<"orders">;

/**
 * A digital invitation an order paid for and didn't unlock: how it was
 * unlocked before, or null if it still isn't.
 */
export type Unopened = { event: Id<"events">; unlocked: Unlock | null };

const words = {
  ro: {
    subject: (name: string) => `Comanda ${name} · Jolene`,
    thanks: (first: string) => (first ? `Mulțumim, ${first}!` : "Mulțumim!"),
    received: (name: string, total: string) =>
      `Am primit comanda ${name} și plata de ${total}.`,
    questions: "Dacă aveți întrebări despre ea, răspundeți la acest email.",
    test: "Comandă de test: plătită în modul de test al Stripe, fără bani.",
    button: "Vedeți comanda",
    design: "Cu designul vostru",
    forEvent: (hosts: string) => `Pentru ${hosts}`,
    subtotal: "Subtotal",
    delivery: "Livrare",
    discount: "Reducere",
    total: "Total",
    vat: "Din care TVA",
    free: "gratuit",
    address: "Livrăm la",
    pickup: "Ridicați comanda de la atelier",
    pickupNote: "Vă anunțăm când e gata de ridicat.",
    unlockNow:
      "Înainte de plată ați cerut să deblocăm invitația digitală imediat și ați luat la cunoștință că, odată deblocată, nu mai puteți renunța la ea în 14 zile.",
    invoiceSubject: (name: string) => `Factura comenzii ${name} · Jolene`,
    invoiceReady: (name: string, invoice: string) =>
      `Factura comenzii ${name} e gata: ${invoice}.`,
    invoiceButton: "Descărcați factura",
    invoicePage: "O găsiți oricând și pe pagina comenzii",
    shipmentSubject: (name: string) =>
      `Comanda ${name} pleacă spre voi · Jolene`,
    shipped: (first: string, name: string, courier: string) =>
      `${first ? `${first}, c` : "C"}omanda ${name} e gata și pleacă spre voi cu ${courier || "curierul"}.`,
    awb: (awb: string) => `Numărul ei de urmărire (AWB) e ${awb}.`,
    follow: (courier: string) =>
      `O urmăriți cu el pe site-ul ${courier || "curierului"} sau pe pagina comenzii.`,
    readySubject: (name: string) =>
      `Comanda ${name} e gata de ridicat · Jolene`,
    ready: (first: string, name: string) =>
      `${first ? `${first}, c` : "C"}omanda ${name} e gata: o puteți ridica de la atelier, ${WORKSHOP_ADDRESS}.`,
    readyReply:
      "Dacă vreți să ne spuneți când veniți, răspundeți la acest email.",
    footer: "Jolene · jolene.ro",
  },
  en: {
    subject: (name: string) => `Order ${name} · Jolene`,
    thanks: (first: string) => (first ? `Thank you, ${first}!` : "Thank you!"),
    received: (name: string, total: string) =>
      `We've received order ${name} and your payment of ${total}.`,
    questions: "If you have any questions about it, reply to this email.",
    test: "A test order: paid in Stripe's test mode, with no money taken.",
    button: "View your order",
    design: "With your design",
    forEvent: (hosts: string) => `For ${hosts}`,
    subtotal: "Subtotal",
    delivery: "Delivery",
    discount: "Discount",
    total: "Total",
    vat: "Including VAT",
    free: "free",
    address: "Delivering to",
    pickup: "Pick up your order from the workshop",
    pickupNote: "We'll let you know when it's ready.",
    unlockNow:
      "Before paying, you asked us to unlock the digital invitation right away, and acknowledged that once it's unlocked you can no longer withdraw from it within 14 days.",
    invoiceSubject: (name: string) => `Invoice for order ${name} · Jolene`,
    invoiceReady: (name: string, invoice: string) =>
      `The invoice for order ${name} is ready: ${invoice}.`,
    invoiceButton: "Download the invoice",
    invoicePage: "You'll also find it on your order's page",
    shipmentSubject: (name: string) => `Order ${name} is on its way · Jolene`,
    shipped: (first: string, name: string, courier: string) =>
      `${first ? `${first}, o` : "O"}rder ${name} is ready and on its way to you with ${courier || "the courier"}.`,
    awb: (awb: string) => `Its tracking number (AWB) is ${awb}.`,
    follow: (courier: string) =>
      `Follow it with that number on ${courier ? `${courier}'s` : "the courier's"} website, or on your order's page.`,
    readySubject: (name: string) =>
      `Order ${name} is ready to pick up · Jolene`,
    ready: (first: string, name: string) =>
      `${first ? `${first}, o` : "O"}rder ${name} is ready: you can pick it up from the workshop, ${WORKSHOP_ADDRESS}.`,
    readyReply:
      "If you'd like to tell us when you're coming, reply to this email.",
    footer: "Jolene · jolene.ro",
  },
} as const;

/** "[Test] " before a test order's subjects. */
const testMark = (order: Order) => (order.test ? "[Test] " : "");

/** The couple picks it up from the workshop: nothing goes to their address. */
const pickedUp = (order: Order) => order.delivery?.key === "pickup";

/**
 * The name to thank: the first word of the name the parcel goes to, as the
 * couple typed it, else the payer's. A name typed in capitals, as cards
 * carry it, is written as a name.
 */
function firstName(order: Order): string {
  const first =
    (order.address?.name || order.customer.name).trim().split(/\s+/)[0] ?? "";
  return first === first.toUpperCase()
    ? first.charAt(0) + first.slice(1).toLowerCase()
    : first;
}

/** A line's choices, "name: value", as the couple made them. */
function choices(line: Order["lines"][number]): string[] {
  return [
    ...line.options.map(({ name, value }) => `${name}: ${value}`),
    ...line.answers.map(({ label, value }) => `${label}: ${value}`),
  ];
}

/** The address's lines, as a courier reads them. */
function addressLines(address: Address): string[] {
  // București's county is București: once is enough.
  const county = address.county !== address.city && address.county;
  return [
    address.name,
    address.line1,
    ...(address.line2 ? [address.line2] : []),
    [address.city, county, address.postalCode].filter(Boolean).join(", "),
    ...(address.country === "RO" ? [] : [address.country]),
  ];
}

/** Whether two addresses are one place, whoever they name. */
const samePlace = (a: Address, b: Address) =>
  a.line1 === b.line1 &&
  a.line2 === b.line2 &&
  a.city === b.city &&
  a.postalCode === b.postalCode &&
  a.country === b.country;

/**
 * Who the invoice is for, as the team's notice says it: the company and its
 * tax code, or the person, and the billing address unless it's the one above.
 */
function billingLines(order: Order): string[] {
  const { billing } = order;
  if (!billing) return [];
  const company = [billing.company, billing.taxId && `CUI ${billing.taxId}`]
    .filter(Boolean)
    .join(" · ");
  const { address } = billing;
  return [
    company
      ? `Factură pe firmă: ${company}`
      : `Factură pe persoană fizică: ${address.name}`,
    ...(order.address && samePlace(order.address, address)
      ? ["Adresa de facturare: aceeași cu cea de mai sus"]
      : ["Adresa de facturare:", ...addressLines(address)]),
    ...(address.country === "RO" && !address.county
      ? ["Județul lipsește din adresa de facturare: completați-l pe factură."]
      : []),
  ];
}

/** What the order adds up to, each with its amount, and the VAT in it. */
function totals(order: Order, w: (typeof words)[keyof typeof words]) {
  return [
    [w.subtotal, lei(order.subtotal)],
    ...(order.delivery
      ? [
          [
            `${w.delivery} (${order.delivery.label})`,
            order.delivery.price > 0 ? lei(order.delivery.price) : w.free,
          ],
        ]
      : []),
    ...(order.discount > 0 ? [[w.discount, lei(-order.discount)]] : []),
    [w.total, lei(order.total)],
    ...(order.vat ? [[w.vat, lei(order.vat)]] : []),
  ] as [string, string][];
}

const sans = "font-family:Helvetica,Arial,sans-serif;";
const muted = "color:#5c544d;";

const paragraph = (text: string) =>
  `<tr><td style="padding-bottom:12px;font-size:17px;line-height:26px;">${escapeHtml(text)}</td></tr>`;

const note = (text: string) =>
  `<tr><td style="padding-bottom:12px;${sans}font-size:14px;line-height:22px;${muted}">${escapeHtml(text)}</td></tr>`;

/** A row with a label on the left and an amount on the right. */
function amountRow(label: string, amount: string, bold = false) {
  const weight = bold ? "font-weight:bold;" : "";
  return `<tr><td style="padding-top:6px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
<td style="${sans}font-size:15px;line-height:22px;${weight}">${escapeHtml(label)}</td>
<td align="right" style="${sans}font-size:15px;line-height:22px;white-space:nowrap;${weight}">${escapeHtml(amount)}</td>
</tr></table></td></tr>`;
}

/** A line of the order: its picture, what it is, and what it cost. */
function lineRow(
  line: Order["lines"][number],
  picture: string | null,
  details: string[],
) {
  const image = picture
    ? `<td width="96" valign="top" style="padding-right:16px;"><img src="${escapeHtml(picture)}" width="96" alt="" style="display:block;width:96px;height:auto;border:0;"></td>`
    : "";
  return `<tr><td style="padding:16px 0;border-top:1px solid #e8e0d6;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
${image}<td valign="top" style="${sans}font-size:15px;line-height:22px;"><strong>${line.quantity} × ${escapeHtml(line.title)}</strong>${details
    .map(
      (detail) =>
        `<br><span style="font-size:13px;line-height:19px;${muted}">${escapeHtml(detail)}</span>`,
    )
    .join("")}</td>
<td valign="top" align="right" style="padding-left:12px;${sans}font-size:15px;line-height:22px;white-space:nowrap;">${escapeHtml(lei(line.total))}</td>
</tr></table></td></tr>`;
}

const button = (link: string, label: string) =>
  `<tr><td style="padding-top:24px;"><a href="${escapeHtml(link)}" style="display:inline-block;background:#2b2622;color:#fbf8f3;${sans}font-size:15px;text-decoration:none;padding:14px 26px;border-radius:999px;">${escapeHtml(label)}</a></td></tr>`;

/**
 * The couple's confirmation of their order, in the language they paid in:
 * what they bought, with the picture of each line, what they paid, where it
 * goes or where they pick it up, and the link to the order's page.
 */
export function confirmationEmail(
  order: Order,
  link: string | null,
  pictures: (string | null)[],
) {
  const w = words[order.language];
  const name = orderName(order.number);
  const intro = [
    w.thanks(firstName(order)),
    w.received(name, lei(order.total)),
    w.questions,
  ];
  // The law wants the agreement confirmed on a durable medium: this email.
  const notes = [
    ...(order.test ? [w.test] : []),
    ...(order.unlockNowAt !== undefined ? [w.unlockNow] : []),
  ];
  const details = (line: Order["lines"][number]) => [
    ...choices(line),
    ...(line.proof ? [w.design] : []),
    ...(line.event ? [w.forEvent(line.event.hosts)] : []),
  ];
  const sums = [
    ...order.fees.map((fee): [string, string] => [fee.label, lei(fee.price)]),
    ...totals(order, w),
  ];
  // Where it goes, under its heading, or where the couple picks it up.
  const destination: [string, string[]] | null = pickedUp(order)
    ? [w.pickup, [WORKSHOP_ADDRESS, w.pickupNote]]
    : order.address
      ? [w.address, addressLines(order.address)]
      : null;
  const text = [
    ...intro,
    ...notes.flatMap((line) => ["", line]),
    "",
    ...order.lines.flatMap((line) => [
      `${line.quantity} × ${line.title}: ${lei(line.total)}`,
      ...details(line).map((detail) => `  ${detail}`),
    ]),
    "",
    ...sums.map(([label, amount]) => `${label}: ${amount}`),
    ...(destination ? ["", `${destination[0]}:`, ...destination[1]] : []),
    ...(link ? ["", `${w.button}: ${link}`] : []),
    "",
    w.footer,
  ].join("\n");
  const html = [
    ...intro.map(paragraph),
    ...notes.map(note),
    ...order.lines.map((line, index) =>
      lineRow(line, pictures[index] ?? null, details(line)),
    ),
    `<tr><td style="border-top:1px solid #e8e0d6;"></td></tr>`,
    ...sums.map(([label, amount]) =>
      amountRow(label, amount, label === w.total),
    ),
    ...(destination
      ? [
          `<tr><td style="padding-top:24px;${sans}font-size:14px;line-height:22px;${muted}"><strong>${escapeHtml(destination[0])}</strong><br>${destination[1].map(escapeHtml).join("<br>")}</td></tr>`,
        ]
      : []),
    ...(link ? [button(link, w.button)] : []),
  ].join("\n");
  return {
    subject: `${testMark(order)}${w.subject(name)}`,
    text,
    html,
    footer: escapeHtml(w.footer),
  };
}

/** Who unlocked a digital invitation before, as the team's notice says it. */
function unlockedBy({ by, order }: Unlock): string {
  switch (by) {
    case "order":
      return `de comanda ${order}`;
    case "print":
      return `de invitațiile tipărite din comanda ${order}`;
    case "hand":
      return `de mână (${order})`;
  }
}

/**
 * What the team does about a digital invitation the order paid for and
 * didn't unlock: refund it, if it was already unlocked, or unlock it by hand.
 * One that came free with printed invitations has nothing to refund.
 */
function unopenedNote(
  line: Order["lines"][number],
  unopened: Unopened | undefined,
): string[] {
  if (!unopened) return [];
  const paid = lei(line.total);
  if (!unopened.unlocked)
    return [
      line.total > 0
        ? `  N-a putut fi deblocată: deblocați-o de mână (invites/unlock:byHand) sau returnați plata de ${paid}.`
        : "  N-a putut fi deblocată: deblocați-o de mână (invites/unlock:byHand).",
    ];
  return line.total > 0
    ? [
        `  Era deja deblocată ${unlockedBy(unopened.unlocked)}, deci plata de ${paid} n-a deblocat nimic: returnați-o.`,
      ]
    : [];
}

/**
 * The notice to Jolene's team of a new order, in Romanian: everything the
 * workshop needs to make and send it, Stripe's payment to find it by, and
 * what to do about each digital invitation it paid for and didn't unlock.
 */
export function noticeEmail(
  order: Order,
  link: string | null,
  unopened: Unopened[] = [],
) {
  const w = words.ro;
  const name = orderName(order.number);
  const { customer } = order;
  const lines = [
    order.test
      ? `Comandă de test ${name}, plătită în modul de test al Stripe: ${lei(order.total)}.`
      : `Comandă nouă ${name}, plătită: ${lei(order.total)}.`,
    "",
    `Client: ${[customer.name, customer.email, customer.phone].filter(Boolean).join(" · ")}`,
    `Limba: ${order.language === "ro" ? "română" : "engleză"}`,
    ...(pickedUp(order)
      ? [`Ridicare de la atelier (${WORKSHOP_ADDRESS}): nu se livrează.`]
      : []),
    ...(order.address
      ? [
          pickedUp(order) ? "Adresa clientului:" : "Adresa:",
          ...addressLines(order.address),
        ]
      : []),
    ...billingLines(order),
    "",
    ...order.lines.flatMap((line) => [
      `${line.quantity} × ${line.title} (${line.product}): ${lei(line.total)}`,
      ...choices(line).map((choice) => `  ${choice}`),
      ...(line.proof ? [`  Design aprobat în studio: ${line.proof}`] : []),
      ...(line.event
        ? [
            `  Pentru ${line.event.hosts}, evenimentul ${line.event.id}`,
            ...unopenedNote(
              line,
              unopened.find(({ event }) => event === line.event?.id),
            ),
          ]
        : []),
    ]),
    ...(order.lines.every((line) => line.event)
      ? [
          "",
          unopened.length
            ? "Nimic de livrat."
            : "Nimic de livrat: comanda deschide invitația digitală tuturor invitaților.",
        ]
      : []),
    "",
    ...order.fees.map((fee) => `${fee.label}: ${lei(fee.price)}`),
    ...totals(order, w).map(([label, amount]) => `${label}: ${amount}`),
    ...(order.vat === 0 && order.total > 0
      ? [
          "",
          "Stripe Tax n-a pus TVA în comandă: verificați în Stripe, la Tax > Locations, că România e adăugată.",
        ]
      : []),
    ...(order.paymentIntent
      ? ["", `Plata în Stripe: ${order.paymentIntent}`]
      : []),
    ...(link ? [`Pagina comenzii: ${link}`] : []),
  ];
  return {
    subject: `${testMark(order)}Comandă nouă ${name} · ${lei(order.total)} · ${customer.name}`,
    text: lines.join("\n"),
    html: lines
      .map((line) =>
        line
          ? `<tr><td style="${sans}font-size:14px;line-height:22px;white-space:pre-wrap;">${escapeHtml(line)}</td></tr>`
          : `<tr><td style="height:12px;"></td></tr>`,
      )
      .join("\n"),
    footer: "Jolene · comenzi",
  };
}

/**
 * The couple's invoice, once SmartBill has issued it, in the language they
 * paid in: its series and number, and the link that downloads its PDF.
 */
export function invoiceEmail(
  order: Order,
  invoice: string,
  download: string,
  link: string,
) {
  const w = words[order.language];
  const name = orderName(order.number);
  const ready = w.invoiceReady(name, invoice);
  return {
    subject: `${testMark(order)}${w.invoiceSubject(name)}`,
    text: [
      ready,
      "",
      `${w.invoiceButton}: ${download}`,
      `${w.invoicePage}: ${link}`,
      "",
      w.footer,
    ].join("\n"),
    html: [
      paragraph(ready),
      button(download, w.invoiceButton),
      `<tr><td style="padding-top:20px;${sans}font-size:14px;line-height:22px;${muted}"><a href="${escapeHtml(link)}" style="color:#5c544d;">${escapeHtml(w.invoicePage)}</a>.</td></tr>`,
    ].join("\n"),
    footer: escapeHtml(w.footer),
  };
}

/**
 * The team's notice, in Romanian, that SmartBill refused an order's invoice
 * or credit note, or issued it with something to look at.
 */
export function invoiceNotice(
  order: Order,
  {
    document,
    issued,
    problem,
  }: {
    document: "invoice" | "creditNote";
    /** Its series and number, when SmartBill issued it. */
    issued?: string;
    problem: string;
  },
  link: string | null,
) {
  const name = orderName(order.number);
  const what = document === "invoice" ? "Factura" : "Factura de stornare";
  const lines = [
    issued
      ? `${what} comenzii ${name} e emisă în SmartBill (${issued}), dar: ${problem}`
      : `SmartBill n-a emis ${what.toLowerCase()} comenzii ${name}: ${problem}`,
    ...(issued
      ? []
      : ["", "Emiteți-o de mână în SmartBill, sau din nou din atelier."]),
    "",
    `Client: ${[order.customer.name, order.customer.email].filter(Boolean).join(" · ")}`,
    `Total: ${lei(order.total)}`,
    ...(link ? [`Pagina comenzii: ${link}`] : []),
  ];
  return {
    subject: `${testMark(order)}${what} comenzii ${name} · de verificat`,
    text: lines.join("\n"),
    html: lines
      .map((line) =>
        line
          ? `<tr><td style="${sans}font-size:14px;line-height:22px;white-space:pre-wrap;">${escapeHtml(line)}</td></tr>`
          : `<tr><td style="height:12px;"></td></tr>`,
      )
      .join("\n"),
    footer: "Jolene · comenzi",
  };
}

/**
 * The couple's word that their parcel is on its way, in the language they
 * paid in: the courier taking it, its AWB, and the order's page, which
 * shows where it is.
 */
export function shipmentEmail(
  order: Order,
  { courier, awb }: { courier: string; awb: string },
  link: string | null,
) {
  const w = words[order.language];
  const name = orderName(order.number);
  const lines = [
    w.shipped(firstName(order), name, courier),
    ...(awb ? [w.awb(awb), w.follow(courier)] : []),
  ];
  return {
    subject: `${testMark(order)}${w.shipmentSubject(name)}`,
    text: [
      ...lines,
      ...(link ? ["", `${w.button}: ${link}`] : []),
      "",
      w.footer,
    ].join("\n"),
    html: [
      ...lines.map(paragraph),
      ...(link ? [button(link, w.button)] : []),
    ].join("\n"),
    footer: escapeHtml(w.footer),
  };
}

/**
 * The couple's word that the order they chose to pick up is ready at the
 * workshop, in the language they paid in.
 */
export function pickupReadyEmail(order: Order, link: string | null) {
  const w = words[order.language];
  const name = orderName(order.number);
  const lines = [w.ready(firstName(order), name), w.readyReply];
  return {
    subject: `${testMark(order)}${w.readySubject(name)}`,
    text: [
      ...lines,
      ...(link ? ["", `${w.button}: ${link}`] : []),
      "",
      w.footer,
    ].join("\n"),
    html: [
      ...lines.map(paragraph),
      ...(link ? [button(link, w.button)] : []),
    ].join("\n"),
    footer: escapeHtml(w.footer),
  };
}

/**
 * The team's notice, in Romanian, that Colete Online didn't book an
 * order's courier, or booked it with something to look at.
 */
export function shipmentNotice(
  order: Order,
  { booked, problem }: { booked?: string; problem: string },
  link: string | null,
) {
  const name = orderName(order.number);
  const lines = [
    booked
      ? `Curierul comenzii ${name} e comandat în Colete Online (${booked}), dar: ${problem}`
      : `Colete Online n-a comandat curierul comenzii ${name}: ${problem}`,
    ...(booked
      ? []
      : ["", "Comandați-l din nou din atelier sau direct în Colete Online."]),
    "",
    ...(order.address ? ["Livrăm la:", ...addressLines(order.address)] : []),
    `Telefon: ${order.customer.phone || "—"}`,
    ...(link ? [`Pagina comenzii: ${link}`] : []),
  ];
  return {
    subject: `${testMark(order)}Curierul comenzii ${name} · de verificat`,
    text: lines.join("\n"),
    html: lines
      .map((line) =>
        line
          ? `<tr><td style="${sans}font-size:14px;line-height:22px;white-space:pre-wrap;">${escapeHtml(line)}</td></tr>`
          : `<tr><td style="height:12px;"></td></tr>`,
      )
      .join("\n"),
    footer: "Jolene · comenzi",
  };
}
