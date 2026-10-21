import type { Metadata } from "next";

import { LegalPage } from "@/components/legal/legal-page";
import { ReturnsRo } from "@/components/legal/returns";
import { getLegalMetadata } from "@/lib/legal";

export const metadata: Metadata = getLegalMetadata("returns", "ro");

export default function ReturnsPage() {
  return (
    <LegalPage language="ro" page="returns">
      <ReturnsRo />
    </LegalPage>
  );
}
