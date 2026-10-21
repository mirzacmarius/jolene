import { useEffect, useState } from "react";

/**
 * How long Colete Online or SmartBill may leave a booking or an invoice
 * unanswered before the workshop can ask again (STUCK in
 * convex/shipments.ts and convex/invoices.ts).
 */
const STUCK = 15 * 60_000;

/**
 * Whether what the workshop asked for at `since` has waited so long it can
 * ask again: it turns true on its own once that time comes.
 */
export function useStuck(since: number | undefined): boolean {
  const [, rerender] = useState(0);
  useEffect(() => {
    if (since === undefined) return;
    const wait = since + STUCK - Date.now();
    if (wait <= 0) return;
    // A second late, so the clock has surely passed it.
    const timer = setTimeout(() => rerender((count) => count + 1), wait + 1000);
    return () => clearTimeout(timer);
  }, [since]);
  return since !== undefined && Date.now() - since >= STUCK;
}
