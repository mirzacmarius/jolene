import type { Doc } from "../_generated/dataModel";
import { orderName } from "../orders/format";
import type { Parcel } from "../orders/validators";

/**
 * The booking Colete Online takes for an order's parcel, as its API takes
 * it: from the workshop's saved address to the couple's door, by the
 * cheapest courier, with the order's number for a reference and the
 * address to tell of its progress at.
 */

/** What Jolene's parcels hold, as couriers ask. */
const CONTENT = "Papetărie";

/** The box most orders travel in, unless the workshop weighs another. */
export const STANDARD_PARCEL: Parcel = {
  weight: 1,
  length: 35,
  width: 25,
  height: 5,
};

/** A parcel couriers take: up to 31.5 kg and 2 m a side, as the workshop measured it. */
export function validParcel(parcel: Parcel): boolean {
  return (
    parcel.weight > 0 &&
    parcel.weight <= 31.5 &&
    [parcel.length, parcel.width, parcel.height].every(
      (side) => side > 0 && side <= 200,
    )
  );
}

/**
 * An address's first line as couriers want it, the street apart from its
 * number, and what follows them, such as the block and flat: "Str. Florilor
 * nr. 1, bl. A2, ap. 5" is Str. Florilor, 1, and bl. A2, ap. 5. A line with
 * no number to find stays whole.
 */
export function streetOf(line: string) {
  const trimmed = line.trim();
  const marked =
    /^(.*?)[\s,]*\bnr\.?\s*(\d+[a-z]?(?:\s*[-/]\s*\d+[a-z]?)?)\b[\s,]*(.*)$/iu.exec(
      trimmed,
    );
  if (marked?.[1])
    return {
      street: marked[1],
      number: (marked[2] ?? "").replace(/\s/g, ""),
      rest: marked[3] ?? "",
    };
  const [head = "", ...tail] = trimmed.split(",");
  const ending = /^(.*\S)\s+(\d+[a-z]?(?:\s*[-/]\s*\d+[a-z]?)?)$/iu.exec(
    head.trim(),
  );
  return ending?.[1]
    ? {
        street: ending[1],
        number: (ending[2] ?? "").replace(/\s/g, ""),
        rest: tail.join(",").trim(),
      }
    : { street: trimmed, number: "", rest: "" };
}

/** A Romanian phone number as couriers dial it: 07…, not +407…. */
function phoneOf(phone: string | undefined): string {
  const digits = (phone ?? "").replace(/[\s().-]/g, "");
  return digits.startsWith("+40") ? `0${digits.slice(3)}` : digits;
}

/**
 * The booking for `order`'s parcel, collected from the saved address
 * `addressId`, whose progress Colete Online tells `hook` of.
 */
export function bookingOf(
  order: Doc<"orders">,
  parcel: Parcel,
  addressId: number,
  hook: { url: string; key: string },
) {
  const address = order.address;
  if (!address) throw new Error(`Order ${order.number} goes to no address`);
  const { street, number, rest } = streetOf(address.line1);
  return {
    sender: { addressId },
    recipient: {
      contact: {
        name: address.name || order.customer.name,
        phone: phoneOf(order.customer.phone),
        email: order.customer.email,
      },
      address: {
        countryCode: address.country,
        postalCode: address.postalCode ?? "",
        city: address.city,
        county: address.county ?? "",
        street,
        number,
        additionalInfo: [rest, address.line2].filter(Boolean).join(", "),
      },
      validationStrategy: "minimal",
    },
    packages: {
      content: CONTENT,
      // A box, not an envelope.
      type: 2,
      list: [parcel],
    },
    service: { selectionType: "bestPrice" },
    extraOptions: [
      // Tells `hook` of each change in the parcel's progress.
      { id: 1, url: hook.url, secretKey: hook.key },
      { id: 9, clientReference: orderName(order.number) },
    ],
  };
}
