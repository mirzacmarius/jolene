import type { Metadata } from "next";

import { ProductsGrid } from "@/components/product/products-grid";
import { StudioLink } from "@/components/studio/studio-link";
import { Container } from "@/components/ui/container";
import { Page } from "@/components/ui/page";
import { Sections } from "@/components/ui/sections";
import { shopConfig } from "@/lib/config";
import { buildAlternates, buildOpenGraph } from "@/lib/seo";

export async function generateMetadata(): Promise<Metadata> {
  const title = "Papetărie de nuntă și botez";
  const description = shopConfig.site.description;
  return {
    title: `${title} | ${shopConfig.site.name}`,
    description,
    alternates: buildAlternates({ pathname: "/" }),
    openGraph: buildOpenGraph({
      title,
      description,
      url: "/",
      type: "website",
    }),
  };
}

export default function HomePage() {
  return (
    <Page className="pt-0">
      <Sections>
        <section className="grid grid-cols-1">
          <div className="col-start-1 row-start-1 hidden md:block md:aspect-4/1" />
          <div className="relative col-start-1 row-start-1 flex items-center justify-center px-5 py-10 lg:px-10">
            <div className="flex flex-col items-center text-center gap-5">
              <div className="flex flex-col items-center gap-2.5">
                <p className="text-xs font-medium uppercase tracking-[0.28em] text-gold">Jolene</p>
                <h1 className="font-display text-4xl md:text-6xl max-w-3xl text-foreground">
                  Papetăria nunții voastre, creată de voi
                </h1>
                <p className="text-sm md:text-base max-w-xl text-muted-foreground">
                  Alegeți o colecție, scrieți-vă numele și vedeți invitația prinzând viață înainte
                  de a o comanda.
                </p>
              </div>
              <StudioLink className="inline-flex h-11 items-center rounded-full bg-primary px-6 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90">
                Creează-ți invitația
              </StudioLink>
            </div>
          </div>
        </section>

        <Container>
          <ProductsGrid title="Produse" eagerCount={4} limit={8} collectionUrl="/collections/all" />
        </Container>
      </Sections>
    </Page>
  );
}
