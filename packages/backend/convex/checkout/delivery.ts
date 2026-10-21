/**
 * How a printed order reaches the couple, offered on Stripe's checkout page,
 * with its price in bani. One courier at a stand-in price until Jolene sets
 * its couriers, lockers and prices.
 */
export const deliveryOptions = [
  { label: "Curier, la adresă", price: 2000 },
] as const;

/** Where Jolene sends printed orders. */
export const deliveryCountries = ["RO"] as const;
