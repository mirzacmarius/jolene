import type { Metadata } from "next";

import { HomeChristening } from "@/components/home/christening";
import { HomeClosing } from "@/components/home/closing";
import { HomeDelivery } from "@/components/home/delivery";
import { HomeFinishes } from "@/components/home/finishes";
import { HomeHero } from "@/components/home/hero";
import { HomeMotion } from "@/components/home/motion";
import { HomePrices } from "@/components/home/prices";
import { HomeQuestions } from "@/components/home/questions";
import { HomeSteps } from "@/components/home/steps";
import { HomeStory, HomeStrip } from "@/components/home/story";
import { Page } from "@/components/ui/page";
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
    <Page className="overflow-x-clip pt-0">
      <HomeHero />
      <HomeStrip />
      <HomeStory />
      <HomeSteps />
      <HomeFinishes />
      <HomePrices />
      <HomeDelivery />
      <HomeChristening />
      <HomeQuestions />
      <HomeClosing />
      <HomeMotion />
    </Page>
  );
}
