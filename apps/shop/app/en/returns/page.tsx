import type { Metadata } from "next";

import { LegalPage } from "@/components/legal/legal-page";
import { ReturnsEn } from "@/components/legal/returns";
import { getLegalMetadata } from "@/lib/legal";

export const metadata: Metadata = getLegalMetadata("returns", "en");

export default function ReturnsEnPage() {
  return (
    <LegalPage language="en" page="returns">
      <ReturnsEn />
    </LegalPage>
  );
}
