import { CartNotifications } from "./notifications";
import { CartOverlay } from "./overlay";

export function CartUI() {
  return (
    <>
      <CartNotifications />
      <CartOverlay description="Verifică produsele din coș și mergi la plată" title="Coș" />
    </>
  );
}
