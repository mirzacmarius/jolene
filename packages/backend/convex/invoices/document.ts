import { digitalInvitation } from "@jolene/products/digital-invitation";
import type { Doc } from "../_generated/dataModel";
import { orderName } from "../orders/format";
import type { Address } from "../orders/validators";
import type { SmartBill, Tax } from "./smartbill";

/**
 * The invoice SmartBill issues for an order, as its API takes it: who it's
 * made out to, each line at the price the couple paid with VAT inside, the
 * promotion code's discount, delivery, and the card payment that settled it.
 * Invoices are in Romanian, whichever language the couple paid in.
 */

type Order = Doc<"orders">;

/** An order the shop can't invoice through SmartBill: the team does it by hand. */
export class ManualInvoice extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ManualInvoice";
  }
}

/** Lei, from bani: SmartBill counts in lei. */
const lei = (bani: number) => bani / 100;

/** The last Sunday of a month, at 01:00 UTC: when the EU changes its clocks. */
function lastSunday(year: number, month: number): number {
  const last = new Date(Date.UTC(year, month + 1, 0, 1));
  return last.getTime() - last.getUTCDay() * 86_400_000;
}

/**
 * The day it is in Romania at `time`, as YYYY-MM-DD: three hours ahead of
 * UTC in summer time, two otherwise. Without Intl, whose time zones
 * Convex's runtime may not carry.
 */
export function romanianDay(time: number): string {
  const year = new Date(time).getUTCFullYear();
  const summer = time >= lastSunday(year, 2) && time < lastSunday(year, 9);
  return new Date(time + (summer ? 3 : 2) * 3_600_000)
    .toISOString()
    .slice(0, 10);
}

const plain = (text: string) =>
  text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/**
 * The standard VAT rate among SmartBill's, which everything Jolene sells
 * pays: the one SmartBill names Normala, else the highest.
 */
export function standardTax(taxes: Tax[]): Tax | null {
  return (
    taxes.find((tax) => plain(tax.name).startsWith("normal")) ??
    [...taxes].sort((a, b) => b.percentage - a.percentage)[0] ??
    null
  );
}

/**
 * Where an invoice's buyer is, as SmartBill writes it. e-Factura names a
 * Bucharest address's sector as its town, which the postal code's second
 * digit gives.
 */
function place(address: Address) {
  const sector =
    address.country === "RO" &&
    address.county === "București" &&
    /^0([1-6])\d{4}$/.exec(address.postalCode ?? "")?.[1];
  return {
    address: [address.line1, address.line2].filter(Boolean).join(", "),
    city: sector ? `Sector ${sector}` : address.city,
    ...(address.county && { county: address.county }),
    country: address.country === "RO" ? "Romania" : address.country,
  };
}

/** Who the invoice is made out to: the company they bought as, or the payer. */
function client(order: Order) {
  const { billing } = order;
  if (!billing)
    throw new ManualInvoice(
      "Comanda nu are date de facturare: emiteți factura de mână.",
    );
  const taxId = billing.taxId?.replace(/\s/g, "").toUpperCase();
  if (billing.company && billing.address.country !== "RO")
    throw new ManualInvoice(
      `Firmă din afara României (${billing.address.country}): emiteți factura de mână, cu taxare inversă dacă se aplică.`,
    );
  return {
    name: billing.company || billing.address.name || order.customer.name,
    ...(billing.company &&
      taxId && { vatCode: taxId, isTaxPayer: taxId.startsWith("RO") }),
    ...place(billing.address),
    ...(order.customer.email && { email: order.customer.email }),
    saveToDb: false,
  };
}

/**
 * The invoice for `order`, dated `day` in Romania and priced at SmartBill's
 * standard VAT rate. A test order's is a draft, which SmartBill neither
 * numbers nor sends to e-Factura. Throws ManualInvoice for an order the
 * team invoices by hand.
 */
export function invoiceOf(
  order: Order,
  account: SmartBill,
  tax: Tax,
  day: string,
) {
  const vat = {
    isTaxIncluded: true,
    taxName: tax.name,
    taxPercentage: tax.percentage,
  };
  const item = (
    name: string,
    quantity: number,
    price: number,
    isService: boolean,
    description?: string,
  ) => ({
    name,
    ...(description && { productDescription: description }),
    measuringUnitName: "buc",
    currency: "RON",
    quantity,
    price: lei(price),
    ...vat,
    isService,
    saveToDb: false,
  });
  const bought = [
    ...order.lines.map((line) =>
      item(
        line.title,
        line.quantity,
        line.price,
        line.product === digitalInvitation.handle,
        line.options.map(({ name, value }) => `${name}: ${value}`).join(", "),
      ),
    ),
    ...order.fees.map((fee) => item(fee.label, 1, fee.price, true)),
  ];
  return {
    companyVatCode: account.cif,
    client: client(order),
    issueDate: day,
    seriesName: account.series,
    isDraft: order.test,
    currency: "RON",
    precision: 2,
    useStock: false,
    mentions: `Comanda ${orderName(order.number)}, plătită cu cardul.`,
    products: [
      ...bought,
      // The promotion code took this off what was bought, never delivery.
      ...(order.discount > 0
        ? [
            {
              name: "Reducere",
              isDiscount: true,
              numberOfItems: bought.length,
              discountType: 1,
              discountValue: -lei(order.discount),
              measuringUnitName: "buc",
              currency: "RON",
              ...vat,
            },
          ]
        : []),
      ...(order.delivery && order.delivery.price > 0
        ? [item("Livrare prin curier", 1, order.delivery.price, true)]
        : []),
    ],
    // Paid in full by card on Stripe's page; a draft records no payment.
    ...(!order.test &&
      order.total > 0 && {
        payment: {
          value: lei(order.total),
          type: "Card online",
          isCash: false,
        },
      }),
  };
}
