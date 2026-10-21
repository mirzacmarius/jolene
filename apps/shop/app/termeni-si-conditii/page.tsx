import type { Metadata } from "next";

import { LegalPage } from "@/components/legal/legal-page";
import { TermsRo } from "@/components/legal/terms";
import { getLegalMetadata } from "@/lib/legal";

export const metadata: Metadata = getLegalMetadata("terms", "ro");

export default function TermsPage() {
  return (
    <LegalPage language="ro" page="terms">
      <TermsRo />
    </LegalPage>
  );
}
