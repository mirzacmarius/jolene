import type { Metadata } from "next";

import { CompanyDetails, EmailLink, PhoneLink } from "@/components/legal/contact";
import { Container } from "@/components/ui/container";
import { Page } from "@/components/ui/page";
import { Sections } from "@/components/ui/sections";
import { buildAlternates, buildOpenGraph } from "@/lib/seo";

const TITLE = "Contact";
const DESCRIPTION =
  "Scrie-ne sau sună-ne pentru o ofertă, un model personalizat sau o întrebare despre comanda ta.";

export const metadata: Metadata = {
  alternates: buildAlternates({ pathname: "/contact" }),
  description: DESCRIPTION,
  openGraph: buildOpenGraph({ description: DESCRIPTION, title: TITLE, url: "/contact" }),
  title: TITLE,
};

export default function ContactPage() {
  return (
    <Page>
      <Container>
        <Sections className="max-w-3xl">
          <header className="grid gap-4">
            <h1 className="text-3xl sm:text-4xl md:text-5xl">{TITLE}</h1>
            <p className="text-muted-foreground">{DESCRIPTION}</p>
          </header>
          <p className="grid gap-2.5 text-xl sm:text-2xl">
            <EmailLink />
            <PhoneLink language="ro" />
          </p>
          <div className="prose min-w-0 max-w-none prose-stone prose-headings:font-medium prose-a:underline-offset-4 prose-li:my-1">
            <h2>Date de identificare</h2>
            <CompanyDetails language="ro" />
          </div>
        </Sections>
      </Container>
    </Page>
  );
}
