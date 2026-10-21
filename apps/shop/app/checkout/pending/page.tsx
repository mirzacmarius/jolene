import type { Metadata } from "next";

import { Container } from "@/components/ui/container";
import { Link } from "@/components/ui/link";
import { Page } from "@/components/ui/page";

export const metadata: Metadata = {
  robots: { follow: false, index: false },
  title: "Plata se confirmă",
};

export default function CheckoutPendingPage() {
  return (
    <Page>
      <Container>
        <div className="grid max-w-2xl gap-5">
          <h1 className="text-3xl sm:text-4xl md:text-5xl">Plata se confirmă</h1>
          <p className="text-muted-foreground">
            Stripe nu ne-a confirmat încă plata. Când o confirmă, vă trimitem pe email comanda, cu
            linkul ei. Nu e nevoie să plătiți din nou.
          </p>
          <p className="text-muted-foreground">
            Dacă nu primiți nimic în următoarea oră, scrieți-ne la{" "}
            <a
              className="text-foreground underline underline-offset-4"
              href="mailto:invitatii.jolene@gmail.com"
            >
              invitatii.jolene@gmail.com
            </a>
            .
          </p>
          <Link
            className="inline-flex h-12 cursor-pointer items-center justify-center justify-self-start rounded-lg bg-primary px-8 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            href="/collections/all"
          >
            Înapoi la produse
          </Link>
        </div>
      </Container>
    </Page>
  );
}
