import type { Language } from "@jolene/design";
import type { DeliveryKey } from "../orders/validators";

/**
 * How a printed order reaches the couple, offered on Stripe's checkout page
 * with its price in bani. They are jolene.ro's terms: a courier to the door,
 * free from 800 lei, or picked up from the workshop in Iași for nothing. The
 * courier is whichever Colete Online books cheapest for the parcel.
 */

/** Where Jolene sends printed orders. */
export const deliveryCountries = ["RO"] as const;

/** What a courier costs to the door, below FREE_DELIVERY_FROM. */
export const COURIER_PRICE = 2500;

/**
 * From what a checkout's lines and fees come to, before a promotion code,
 * the courier brings it for nothing: 800 lei.
 */
export const FREE_DELIVERY_FROM = 80_000;

/** Where a couple picks up the order they chose to. */
export const WORKSHOP_ADDRESS = "Str. Ion Creangă 41, Iași";

const labels: Record<DeliveryKey, Record<Language, string>> = {
  courier: {
    ro: "Curier la adresă",
    en: "Courier to your door",
  },
  pickup: {
    ro: `Ridicare de la atelier, ${WORKSHOP_ADDRESS}`,
    en: `Pick up from the workshop, ${WORKSHOP_ADDRESS}`,
  },
};

/** What the courier costs a checkout of `subtotal` bani. */
export function courierPrice(subtotal: number): number {
  return subtotal >= FREE_DELIVERY_FROM ? 0 : COURIER_PRICE;
}

/**
 * The ways a checkout of `subtotal` bani can reach the couple, in the
 * language of Stripe's page. Stripe picks the first until they choose.
 */
export function deliveryOptions(subtotal: number, language: Language) {
  return [
    {
      key: "courier",
      label: labels.courier[language],
      price: courierPrice(subtotal),
    },
    { key: "pickup", label: labels.pickup[language], price: 0 },
  ] satisfies { key: DeliveryKey; label: string; price: number }[];
}
