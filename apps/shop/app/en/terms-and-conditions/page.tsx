import type { Metadata } from "next";

import { LegalPage } from "@/components/legal/legal-page";
import { TermsEn } from "@/components/legal/terms";
import { getLegalMetadata } from "@/lib/legal";

export const metadata: Metadata = getLegalMetadata("terms", "en");

export default function TermsEnPage() {
  return (
    <LegalPage language="en" page="terms">
      <TermsEn />
    </LegalPage>
  );
}
