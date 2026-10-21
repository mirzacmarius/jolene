"use client";

import { createContext, type ReactNode, use, useEffect, useRef, useState } from "react";

import {
  addToCartAction,
  removeCartLineAction,
  setCartLineQuantityAction,
} from "@/lib/cart/action";
import type { Cart, CartActionResult, CartLine, CartLineInput } from "@/lib/cart/types";

const FAILED_CHANGE = "Nu am putut actualiza coșul. Încearcă din nou.";

interface CartState {
  /** Undefined until the layout's read arrives; null while the visitor has no cart. */
  cart: Cart | null | undefined;
  change: (action: () => Promise<CartActionResult>) => Promise<string | undefined>;
  isDrawerOpen: boolean;
  isUpdating: boolean;
  setDrawerOpen: (open: boolean) => void;
}

const CartContext = createContext<CartState | null>(null);

interface CartProviderProps {
  // Un-awaited, so no page waits on the visitor's cart.
  cart: Promise<Cart | null>;
  children: ReactNode;
}

export function CartProvider({ cart: read, children }: CartProviderProps) {
  const [cart, setCart] = useState<Cart | null>();
  const [isDrawerOpen, setDrawerOpen] = useState(false);
  const [updates, setUpdates] = useState(0);
  // Each change counts up, so a slower answer to an older change never overwrites a newer one.
  const latest = useRef(0);

  useEffect(() => {
    const version = latest.current;
    let live = true;
    read.then(
      (fresh) => {
        if (live && latest.current === version) setCart(fresh);
      },
      () => {
        if (live && latest.current === version) setCart((current) => current ?? null);
      },
    );
    return () => {
      live = false;
    };
  }, [read]);

  async function change(action: () => Promise<CartActionResult>) {
    const version = ++latest.current;
    setUpdates((count) => count + 1);
    try {
      const result = await action();
      if (latest.current === version) setCart(result.cart);
      return result.error;
    } catch {
      return FAILED_CHANGE;
    } finally {
      setUpdates((count) => count - 1);
    }
  }

  return (
    <CartContext value={{ cart, change, isDrawerOpen, isUpdating: updates > 0, setDrawerOpen }}>
      {children}
    </CartContext>
  );
}

function useCartState() {
  const state = use(CartContext);
  if (!state) throw new Error("Cart hooks need a CartProvider");
  return state;
}

export function useCart() {
  const { cart, isUpdating } = useCartState();
  return { cart, isLoading: cart === undefined, isUpdating };
}

// Each returns the error to show the couple, or nothing once the cart has the change.
export function useCartActions() {
  const { change } = useCartState();
  return {
    add: (line: CartLineInput) => change(() => addToCartAction(line)),
    remove: (lineId: CartLine["id"]) => change(() => removeCartLineAction(lineId)),
    setQuantity: (lineId: CartLine["id"], quantity: number) =>
      change(() => setCartLineQuantityAction(lineId, quantity)),
  };
}

export function useCartDrawer() {
  const { isDrawerOpen, setDrawerOpen } = useCartState();
  return { isOpen: isDrawerOpen, open: () => setDrawerOpen(true), setOpen: setDrawerOpen };
}
