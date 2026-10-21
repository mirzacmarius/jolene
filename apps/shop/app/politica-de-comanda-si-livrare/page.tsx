import type { Metadata } from "next";

import { DeliveryRo } from "@/components/legal/delivery";
import { LegalPage } from "@/components/legal/legal-page";
import { getLegalMetadata } from "@/lib/legal";

export const metadata: Metadata = getLegalMetadata("delivery", "ro");

export default function DeliveryPage() {
  return (
    <LegalPage language="ro" page="delivery">
      <DeliveryRo />
    </LegalPage>
  );
}
