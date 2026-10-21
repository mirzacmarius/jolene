"use client";

import { createCartComponents } from "@shopify/hydrogen/react";
import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";

import { useAgentCartPending } from "@/lib/agent/cart/client";
import { prepareCheckoutAction } from "@/lib/cart/action";

import type { cartHandlers } from "./server";

export const { CartProvider, useCart, useCartActions, useCartForm, useSuspenseCart } =
  createCartComponents<typeof cartHandlers>();

export function useCheckout() {
  const agentPending = useAgentCartPending();
  const cartState = useCart((state) => state);
  const { data: cart, loading, pending, revalidating } = cartState;
  const isUpdatingCart = Boolean(
    agentPending ||
    loading ||
    revalidating ||
    pending.attributes ||
    pending.cost ||
    pending.discountCodes.size ||
    pending.lines.size ||
    pending.note,
  );
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const checkoutErrorId = useId();
  const attempt = useRef<object | null>(null);
  const latestCartState = useRef(cartState);
  const isCheckoutDisabled = isUpdatingCart || isCheckingOut || !cart.lines.nodes.length;

  useLayoutEffect(() => {
    latestCartState.current = cartState;
    if (attempt.current && isUpdatingCart) {
      attempt.current = null;
      setIsCheckingOut(false);
      setCheckoutError("Coșul s-a schimbat. Așteaptă să se actualizeze, apoi încearcă din nou.");
    }
  }, [cartState, isUpdatingCart]);

  useEffect(() => {
    const resetCheckout = () => {
      attempt.current = null;
      setIsCheckingOut(false);
      setCheckoutError(null);
    };
    window.addEventListener("pageshow", resetCheckout);
    return () => {
      attempt.current = null;
      window.removeEventListener("pageshow", resetCheckout);
    };
  }, []);

  async function handleCheckout() {
    if (isCheckoutDisabled || attempt.current) return;
    const currentAttempt = {};
    attempt.current = currentAttempt;
    setCheckoutError(null);
    setIsCheckingOut(true);

    try {
      const { checkoutUrl, problem } = await prepareCheckoutAction();
      if (attempt.current !== currentAttempt) return;
      if (latestCartState.current.data !== cart) {
        setCheckoutError("Coșul s-a schimbat. Încearcă din nou.");
      } else if (problem) {
        setCheckoutError(problem);
      } else if (!checkoutUrl) {
        setCheckoutError("Plata nu e disponibilă acum. Reîncarcă pagina și încearcă din nou.");
      } else {
        window.location.href = checkoutUrl;
        return;
      }
    } catch {
      if (attempt.current !== currentAttempt) return;
      setCheckoutError("Nu am putut porni plata. Încearcă din nou.");
    }

    attempt.current = null;
    setIsCheckingOut(false);
  }

  return {
    checkoutError,
    checkoutErrorId,
    handleCheckout,
    isCheckingOut,
    isCheckoutDisabled,
    isUpdatingCart,
  };
}
