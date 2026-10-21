import type { Metadata } from "next";

import { CookiesEn } from "@/components/legal/cookies";
import { LegalPage } from "@/components/legal/legal-page";
import { getLegalMetadata } from "@/lib/legal";

export const metadata: Metadata = getLegalMetadata("cookies", "en");

export default function CookiesEnPage() {
  return (
    <LegalPage language="en" page="cookies">
      <CookiesEn />
    </LegalPage>
  );
}
