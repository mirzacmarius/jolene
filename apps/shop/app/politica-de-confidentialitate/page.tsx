import type { Metadata } from "next";

import { LegalPage } from "@/components/legal/legal-page";
import { PrivacyRo } from "@/components/legal/privacy";
import { getLegalMetadata } from "@/lib/legal";

export const metadata: Metadata = getLegalMetadata("privacy", "ro");

export default function PrivacyPage() {
  return (
    <LegalPage language="ro" page="privacy">
      <PrivacyRo />
    </LegalPage>
  );
}
