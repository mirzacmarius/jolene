import type { Metadata } from "next";

import { CookiesRo } from "@/components/legal/cookies";
import { LegalPage } from "@/components/legal/legal-page";
import { getLegalMetadata } from "@/lib/legal";

export const metadata: Metadata = getLegalMetadata("cookies", "ro");

export default function CookiesPage() {
  return (
    <LegalPage language="ro" page="cookies">
      <CookiesRo />
    </LegalPage>
  );
}
