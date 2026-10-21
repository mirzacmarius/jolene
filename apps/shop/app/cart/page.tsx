import type { Metadata } from "next";

import { CartPageContent } from "@/components/cart/cart-page";

export const metadata: Metadata = {
  robots: { follow: false, index: false },
  title: "Coș",
};

export default function CartPage() {
  return <CartPageContent />;
}
