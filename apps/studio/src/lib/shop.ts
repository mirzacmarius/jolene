import type { Locale } from "@jolene/i18n";
import { useEffect, useState } from "react";

/** Where a couple writes for what the shop doesn't sell online yet. */
export const JOLENE_EMAIL = "invitatii.jolene@gmail.com";

/**
 * The shop's policies the studio links to, at their address in each
 * language (apps/shop/lib/legal has them all). The shop serves them on the
 * studio's own address, so a path reaches them.
 */
export const POLICIES: Record<Locale, { terms: string; privacy: string }> = {
  ro: {
    terms: "/termeni-si-conditii",
    privacy: "/politica-de-confidentialitate",
  },
  en: { terms: "/en/terms-and-conditions", privacy: "/en/privacy-policy" },
};

/**
 * Whether the shop sells an item, which is whether its product has a page:
 * the shop answers each product page in Markdown too, at its address with
 * ".md". Undefined while the shop is asked. Asked afresh each time, past the
 * browser's cache, which would keep a "not sold" for an hour after the shop
 * starts selling the item.
 */
export function useShopSells(handle: string | null) {
  const [answer, setAnswer] = useState<{ handle: string; sells: boolean }>();
  useEffect(() => {
    if (!handle) return;
    let live = true;
    fetch(`/products/${encodeURIComponent(handle)}.md`, { cache: "no-store" })
      .then((response) => response.ok)
      .catch(() => false)
      .then((sells) => {
        if (live) setAnswer({ handle, sells });
      });
    return () => {
      live = false;
    };
  }, [handle]);
  if (!handle) return false;
  return answer?.handle === handle ? answer.sells : undefined;
}

/** A design the couple approved, with the finishes they picked, to order. */
export interface ProofLine {
  proofId: string;
  quantity: number;
  options: { name: string; value: string }[];
  answers: { key: string; value: string }[];
}

/**
 * Puts a design the couple approved in the shop's cart (ADR 0021). The shop
 * keeps the cart, under a cookie of its own on this address, so the studio
 * asks it to: null once the line is there, else why not, as the cart's
 * error code, or "unknown" when the shop couldn't be asked.
 */
export async function addToCart(line: ProofLine): Promise<string | null> {
  try {
    const response = await fetch("/api/cart/proofs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(line),
    });
    if (response.ok) return null;
    const body: unknown = await response.json().catch(() => null);
    const code =
      typeof body === "object" && body !== null && "error" in body
        ? body.error
        : undefined;
    return typeof code === "string" ? code : "unknown";
  } catch {
    return "unknown";
  }
}

/** How long the shop gets to refresh its pages after a change. */
const REFRESH_WAIT = 8000;

/**
 * Tells the shop the workshop changed its catalog, which its pages keep for
 * minutes unless told: whether they show the change now. The shop takes it
 * from the workshop's accounts alone, by their Convex token.
 */
export async function refreshShop(token: string | null) {
  return await fetch("/api/catalog/refresh", {
    method: "POST",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    signal: AbortSignal.timeout(REFRESH_WAIT),
  }).then(
    (response) => response.ok,
    () => false,
  );
}
