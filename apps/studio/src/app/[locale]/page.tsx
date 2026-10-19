import { Button } from "@jolene/ui/button";
import Link from "next/link";
import { HeroPreview } from "@/components/gallery/hero-preview";
import { SuiteGallery } from "@/components/gallery/suite-gallery";
import { SiteHeader } from "@/components/shell/site-header";
import { getI18n } from "@/locales/server";

/** The studio's welcome: what it does, how, and the collections to start from. */
export default async function Home() {
  const t = await getI18n();
  const steps = [
    { title: t("home.step1Title"), body: t("home.step1Body") },
    { title: t("home.step2Title"), body: t("home.step2Body") },
    { title: t("home.step3Title"), body: t("home.step3Body") },
  ];
  return (
    <>
      <SiteHeader />
      <main>
        <section className="relative overflow-hidden">
          <div
            aria-hidden
            className="absolute inset-0 -z-10 bg-[radial-gradient(60%_50%_at_85%_20%,color-mix(in_oklab,var(--color-blush)_45%,transparent),transparent),radial-gradient(40%_40%_at_10%_90%,color-mix(in_oklab,var(--color-accent)_70%,transparent),transparent)]"
          />
          <div className="mx-auto grid max-w-7xl items-center gap-12 px-4 pb-16 pt-12 sm:px-6 lg:grid-cols-[1.05fr_1fr] lg:gap-16 lg:px-8 lg:pb-24 lg:pt-20">
            <div className="max-w-2xl">
              <p className="text-xs font-medium uppercase tracking-[0.32em] text-gold">
                {t("home.eyebrow")}
              </p>
              <h1 className="mt-5 text-balance font-display text-5xl font-medium leading-[1.02] tracking-tight sm:text-6xl lg:text-7xl">
                {t("home.title")}
              </h1>
              <p className="mt-6 max-w-xl text-pretty text-lg leading-relaxed text-muted-foreground">
                {t("home.lead")}
              </p>
              <div className="mt-9 flex flex-wrap gap-3">
                <Button asChild size="lg">
                  <a href="#colectii">{t("home.browse")}</a>
                </Button>
                <Button asChild size="lg" variant="outline">
                  <Link href="/designurile-mele">{t("common.myDesigns")}</Link>
                </Button>
              </div>
            </div>
            <HeroPreview />
          </div>
        </section>

        <section className="border-y border-border/70 bg-card/60">
          <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
            <h2 className="sr-only">{t("home.stepsTitle")}</h2>
            <ol className="grid gap-10 md:grid-cols-3">
              {steps.map((step, index) => (
                <li key={step.title} className="flex gap-5">
                  <span
                    aria-hidden
                    className="font-display text-5xl italic leading-none text-gold"
                  >
                    {index + 1}
                  </span>
                  <div>
                    <h3 className="font-display text-2xl">{step.title}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                      {step.body}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section
          id="colectii"
          className="mx-auto max-w-7xl scroll-mt-20 px-4 py-20 sm:px-6 lg:px-8"
        >
          <div className="mb-10 max-w-2xl">
            <h2 className="font-display text-4xl sm:text-5xl">
              {t("home.collectionsTitle")}
            </h2>
            <p className="mt-3 text-muted-foreground">
              {t("home.collectionsLead")}
            </p>
          </div>
          <SuiteGallery />
        </section>
      </main>
    </>
  );
}
