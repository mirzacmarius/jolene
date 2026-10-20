import { type Occasion, productKindLabels, productKinds, suiteStyleLabel } from "@jolene/design";
import { suites } from "@jolene/suites";
import { cn } from "cn";
import { ArrowUpRightIcon } from "lucide-react";
import Image, { type StaticImageData } from "next/image";

import { StudioLink } from "@/components/studio/studio-link";
import { Container } from "@/components/ui/container";
import { TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { CollectionPicker } from "./collection-picker";
import autumn from "./collections/autumn.webp";
import boho from "./collections/boho.webp";
import carusel from "./collections/carusel.webp";
import classicRoses from "./collections/classic-roses.webp";
import eucalipt from "./collections/eucalipt.webp";
import forest from "./collections/forest.webp";
import geometricFlowers from "./collections/geometric-flowers.webp";
import royalBlue from "./collections/royal-blue.webp";
import safari from "./collections/safari.webp";
import teddyInBalon from "./collections/teddy-in-balon.webp";
import { PillArrow, pillVariants } from "./pill";
import { Accent, Eyebrow } from "./typography";

// packages/suites/preview/shots.ts draws each collection's invitation into ./collections.
const INVITATIONS: Record<string, StaticImageData> = {
  autumn,
  boho,
  carusel,
  "classic-roses": classicRoses,
  eucalipt,
  forest,
  "geometric-flowers": geometricFlowers,
  "royal-blue": royalBlue,
  safari,
  "teddy-in-balon": teddyInBalon,
};

export interface HomeCollection {
  description: string;
  invitation?: StaticImageData;
  items: string[];
  name: string;
  slug: string;
  styles: string[];
}

export function getHomeCollections(occasion: Occasion): HomeCollection[] {
  return suites
    .filter((suite) => suite.occasion === occasion)
    .map((suite) => ({
      description: suite.description.ro,
      invitation: INVITATIONS[suite.slug],
      items: productKinds
        .filter((kind) => suite.templates.some(({ document }) => document.kind === kind))
        .map((kind) => productKindLabels[kind].ro),
      name: suite.name.ro,
      slug: suite.slug,
      styles: suite.styles.map((style) => suiteStyleLabel(style, "ro")),
    }));
}

export function HomeCollections() {
  const collections = getHomeCollections("wedding");
  const [first] = collections;
  if (!first) return null;

  return (
    <Container aria-labelledby="collections-title" className="scroll-mt-16" id="colectii">
      <div className="grid gap-10 py-24 md:py-28">
        <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
          <div className="grid justify-items-start gap-5">
            <Eyebrow className="reveal" data-reveal>
              Colecțiile de nuntă
            </Eyebrow>
            <h2
              className="reveal reveal-blur text-[clamp(2.75rem,5.5vw,5.25rem)] leading-[1.07] font-normal tracking-[-0.06em]"
              data-reveal
              id="collections-title"
            >
              Alegeți povestea
              <br />
              <Accent>care vă seamănă.</Accent>
            </h2>
          </div>
          <p className="reveal max-w-xs text-[0.8125rem] leading-[1.9]" data-reveal>
            Fiecare colecție aduce invitația și restul papetăriei în același stil, gata să le
            personalizați în studio.
          </p>
        </div>
        <CollectionPicker
          className="reveal grid gap-10 lg:grid-cols-[1.15fr_1fr] lg:items-center"
          defaultValue={first.slug}
        >
          <TabsList aria-label="Colecțiile de nuntă" className="flex-col">
            {collections.map((collection, index) => (
              <TabsTrigger
                className="group/row flex w-full items-center gap-5 border-t px-1 py-5 text-left opacity-50 transition-[opacity,padding] duration-300 last:border-b hover:opacity-80 data-active:pl-4 data-active:opacity-100 md:py-6 motion-reduce:transition-none"
                key={collection.slug}
                value={collection.slug}
              >
                <span className="self-start pt-2 text-[0.625rem]">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <span className="grid min-w-0 gap-2.5">
                  <span className="text-[1.75rem] leading-[1.2] tracking-[-0.045em]">
                    {collection.name}
                  </span>
                  <span className="text-[0.625rem] tracking-[0.12em] uppercase">
                    {collection.styles.join(" · ")}
                  </span>
                </span>
                <ArrowUpRightIcon
                  aria-hidden="true"
                  className="ml-auto size-7 shrink-0 stroke-1 opacity-0 transition-[opacity,rotate] duration-300 group-data-active/row:rotate-45 group-data-active/row:opacity-100 motion-reduce:transition-none"
                />
              </TabsTrigger>
            ))}
          </TabsList>
          {collections.map((collection) => (
            <TabsContent
              className="grid w-full max-w-lg scroll-mt-20 justify-items-center gap-5 justify-self-center rounded-t-[10rem] rounded-b-lg bg-blush/55 px-7.5 pt-12 pb-10 text-center md:px-10 motion-safe:animate-in motion-safe:fade-in motion-safe:duration-500"
              keepMounted
              key={collection.slug}
              value={collection.slug}
            >
              {collection.invitation && (
                <div
                  className="w-[68%] transition-transform duration-300 ease-out [transform:perspective(1000px)_rotateX(var(--tilt-y,0deg))_rotateY(var(--tilt-x,0deg))]"
                  data-tilt
                >
                  <Image
                    alt={`Invitația din colecția ${collection.name}, cu plicul ei`}
                    className="h-auto w-full motion-safe:animate-unveil"
                    sizes="100vw"
                    src={collection.invitation}
                  />
                </div>
              )}
              <Eyebrow className="text-[0.5625rem]">
                {collection.items.length} feluri de papetărie, în același stil
              </Eyebrow>
              <h3 className="font-display text-[2.8125rem] leading-[1.1] italic">
                {collection.name}
              </h3>
              <p className="max-w-xs text-[0.8125rem] leading-[1.85]">{collection.description}</p>
              <ul className="flex flex-wrap justify-center gap-2.5 text-[0.5625rem] tracking-[0.12em] uppercase">
                {collection.items.map((item) => (
                  <li className="rounded-full border border-foreground/20 px-2.5 py-1" key={item}>
                    {item}
                  </li>
                ))}
              </ul>
              <StudioLink
                className={cn(pillVariants(), "text-xs")}
                path={`/colectii/${collection.slug}`}
              >
                Personalizați colecția <PillArrow />
              </StudioLink>
            </TabsContent>
          ))}
        </CollectionPicker>
      </div>
    </Container>
  );
}
