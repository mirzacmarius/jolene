/** The first order's number: J1001. */
export const FIRST_ORDER = 1001;

/** What the couple and the workshop call an order, such as J1001. */
export function orderName(number: number): string {
  return `J${number}`;
}

/**
 * A price in bani as Romanian shops write it, "1.234,50 lei", without Intl,
 * whose locale data Convex's runtime may not carry.
 */
export function lei(bani: number): string {
  const sign = bani < 0 ? "-" : "";
  const whole = Math.floor(Math.abs(bani) / 100);
  const cents = String(Math.abs(bani) % 100).padStart(2, "0");
  const grouped = String(whole).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${sign}${grouped},${cents} lei`;
}
