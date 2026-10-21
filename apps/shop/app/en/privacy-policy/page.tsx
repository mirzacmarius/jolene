import type { Metadata } from "next";

import { LegalPage } from "@/components/legal/legal-page";
import { PrivacyEn } from "@/components/legal/privacy";
import { getLegalMetadata } from "@/lib/legal";

export const metadata: Metadata = getLegalMetadata("privacy", "en");

export default function PrivacyEnPage() {
  return (
    <LegalPage language="en" page="privacy">
      <PrivacyEn />
    </LegalPage>
  );
}
