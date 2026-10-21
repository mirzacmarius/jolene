import type { Metadata } from "next";

import { DeliveryEn } from "@/components/legal/delivery";
import { LegalPage } from "@/components/legal/legal-page";
import { getLegalMetadata } from "@/lib/legal";

export const metadata: Metadata = getLegalMetadata("delivery", "en");

export default function DeliveryEnPage() {
  return (
    <LegalPage language="en" page="delivery">
      <DeliveryEn />
    </LegalPage>
  );
}
