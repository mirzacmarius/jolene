import type { Doc } from "../_generated/dataModel";
import { WORKSHOP_ADDRESS } from "../checkout/delivery";
import { escapeHtml } from "../emails";
import { lei, orderName } from "./format";

/**
 * An order's emails, which Convex writes itself: the couple's confirmation,
 * in the language they paid in, and the notice to Jolene's team, in
 * Romanian. Romanian speaks to the couple in the plural, as the shop does.
 */

type Order = Doc<"orders">;

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
function addressLines(address: NonNullable<Order["address"]>): string[] {
  return [
    address.name,
    address.line1,
    ...(address.line2 ? [address.line2] : []),
    [address.city, address.county, address.postalCode]
      .filter(Boolean)
      .join(", "),
    ...(address.country === "RO" ? [] : [address.country]),
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
    ...(order.test ? ["", w.test] : []),
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
    ...(order.test ? [note(w.test)] : []),
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

/**
 * The notice to Jolene's team of a new order, in Romanian: everything the
 * workshop needs to make and send it, and Stripe's payment to find it by.
 */
export function noticeEmail(order: Order, link: string | null) {
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
    "",
    ...order.lines.flatMap((line) => [
      `${line.quantity} × ${line.title} (${line.product}): ${lei(line.total)}`,
      ...choices(line).map((choice) => `  ${choice}`),
      ...(line.proof ? [`  Design aprobat în studio: ${line.proof}`] : []),
      ...(line.event
        ? [`  Pentru ${line.event.hosts}, evenimentul ${line.event.id}`]
        : []),
    ]),
    ...(order.lines.every((line) => line.event)
      ? [
          "",
          "Nimic de livrat: comanda deschide invitația digitală tuturor invitaților.",
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
