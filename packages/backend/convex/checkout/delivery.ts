import type { Language } from "@jolene/design";
import type { DeliveryKey } from "../orders/validators";

/**
 * How a printed order reaches the couple, offered on Stripe's checkout page
 * with its price in bani. They are jolene.ro's terms: Cargus to the door,
 * free from 800 lei, or picked up from the workshop in Iași for nothing.
 */

/** Where Jolene sends printed orders. */
export const deliveryCountries = ["RO"] as const;

/** What Cargus costs to the door, below FREE_DELIVERY_FROM. */
export const COURIER_PRICE = 2500;

/**
 * From what a checkout's lines and fees come to, before a promotion code,
 * Cargus brings it for nothing: 800 lei.
 */
export const FREE_DELIVERY_FROM = 80_000;

/** Where a couple picks up the order they chose to. */
export const WORKSHOP_ADDRESS = "Str. Ion Creangă 41, Iași";

const labels: Record<DeliveryKey, Record<Language, string>> = {
  cargus: {
    ro: "Curier Cargus, la adresă",
    en: "Cargus courier, to your door",
  },
  pickup: {
    ro: `Ridicare de la atelier, ${WORKSHOP_ADDRESS}`,
    en: `Pick up from the workshop, ${WORKSHOP_ADDRESS}`,
  },
};

/** What Cargus costs a checkout of `subtotal` bani. */
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
      key: "cargus",
      label: labels.cargus[language],
      price: courierPrice(subtotal),
    },
    { key: "pickup", label: labels.pickup[language], price: 0 },
  ] satisfies { key: DeliveryKey; label: string; price: number }[];
}
