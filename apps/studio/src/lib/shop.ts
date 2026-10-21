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
