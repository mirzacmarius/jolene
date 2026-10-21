"use client";

import { type RefObject, useEffect, useRef } from "react";

import { useCart } from "@/lib/cart/client";
import { planCartChange } from "@/lib/line-options";

type CartState = Parameters<Parameters<typeof useCart>[0]>[0];

// A change that failed three times isn't sent again on every cart update; checkout reports the cart instead.
const failures = new Map<string, number>();

export function useLineOptionsKeeper() {
  const state = useCart((cart) => cart);
  const latest = useRef(state);
  const busy = useRef(false);

  useEffect(() => {
    latest.current = state;
    keepLineOptions(latest, busy);
  }, [state]);
}

// Changes only a settled cart, one change at a time, or it would react to its own projections.
function keepLineOptions(latest: RefObject<CartState>, busy: RefObject<boolean>, waits = 0) {
  const { data, loading, pending, readyPromise, revalidating } = latest.current;
  const settled =
    !loading &&
    !readyPromise &&
    !revalidating &&
    !pending.attributes &&
    !pending.cost &&
    !pending.discountCodes.size &&
    !pending.lines.size &&
    !pending.note;
  if (busy.current || !settled || !data.id) return;
  const change = planCartChange(data.lines.nodes);
  const signature = JSON.stringify(change);
  if (!change || (failures.get(signature) ?? 0) >= 3) return;
  const updateCart = window.Shopify?.actions.updateCart;
  // The cart store points Standard Actions at /api/cart once the document has loaded.
  if (!updateCart || updateCart.isDefault()) {
    if (waits >= 20) return;
    busy.current = true;
    setTimeout(() => {
      busy.current = false;
      keepLineOptions(latest, busy, waits + 1);
    }, 500);
    return;
  }
  busy.current = true;
  const fail = () => failures.set(signature, (failures.get(signature) ?? 0) + 1);
  updateCart({ lines: "add" in change ? change.add : [change.update] })
    .then((result) => {
      if (result.userErrors?.length) fail();
    })
    .catch(fail)
    .finally(() => {
      busy.current = false;
      keepLineOptions(latest, busy);
    });
}
