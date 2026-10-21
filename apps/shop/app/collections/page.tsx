import type { Metadata } from "next";

import { CategoryCard } from "@/components/categories/category-card";
import { Container } from "@/components/ui/container";
import { Page } from "@/components/ui/page";
import { Sections } from "@/components/ui/sections";
import { getCategories } from "@/lib/categories/server";
import { buildAlternates, buildOpenGraph } from "@/lib/seo";

const TITLE = "Categorii";
const DESCRIPTION = "Invitații de nuntă și botez, meniuri, place carduri, mărturii și accesorii.";

export const metadata: Metadata = {
  alternates: buildAlternates({ pathname: "/collections" }),
  description: DESCRIPTION,
  openGraph: buildOpenGraph({
    description: DESCRIPTION,
    title: TITLE,
    type: "website",
    url: "/collections",
  }),
  title: TITLE,
  twitter: {
    card: "summary_large_image",
    description: DESCRIPTION,
    images: ["/og-default.png"],
    title: TITLE,
  },
};

export default async function CategoriesPage() {
  const categories = await getCategories();
  return (
    <Page className="pt-2.5 md:pt-10">
      <Container>
        <Sections className="gap-5">
          <h1 className="text-3xl sm:text-4xl md:text-5xl">{TITLE}</h1>
          {categories.length > 0 ? (
            <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-4">
              {categories.map((category) => (
                <CategoryCard category={category} key={category.handle} />
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground">Nicio categorie deocamdată.</p>
          )}
        </Sections>
      </Container>
    </Page>
  );
}
