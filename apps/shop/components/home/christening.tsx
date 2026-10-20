import Image from "next/image";

import { StudioLink } from "@/components/studio/studio-link";
import { Container } from "@/components/ui/container";

import { getHomeCollections } from "./collections";
import christening from "./photos/christening.jpg";
import { Accent, Eyebrow } from "./typography";

export function HomeChristening() {
  const collections = getHomeCollections("christening");
  if (collections.length === 0) return null;

  return (
    <Container aria-labelledby="christening-title" className="scroll-mt-20" data-scene id="botez">
      <div className="grid md:min-h-180 md:grid-cols-2 md:gap-10">
        <div className="grid content-center justify-items-start gap-5 py-20 md:py-21">
          <Eyebrow className="reveal" data-reveal>
            Pentru botez
          </Eyebrow>
          <h2
            className="reveal reveal-blur text-[clamp(3.25rem,6vw,5.75rem)] leading-[1.07] font-normal tracking-[-0.06em]"
            data-reveal
            id="christening-title"
          >
            Un botez
            <br />
            începe cu
            <br />
            <Accent>o poveste.</Accent>
          </h2>
          <p className="reveal max-w-xs text-sm leading-[1.9]" data-reveal>
            Ursuleți în balon, carusele și animăluțe din junglă, desenate în acuarelă pentru
            invitații, meniuri și plicuri de bani, cu numele celui mic.
          </p>
          <ul
            className="reveal grid w-full max-w-md grid-cols-2 gap-2.5 sm:grid-cols-4"
            data-reveal
          >
            {collections.map((collection) => (
              <li key={collection.slug}>
                <StudioLink
                  className="group/tile grid gap-2.5 rounded-lg bg-secondary p-2.5 text-center text-xs outline-none transition-colors hover:bg-accent focus-visible:ring-3 focus-visible:ring-ring/50"
                  path={`/colectii/${collection.slug}`}
                >
                  <span className="relative block aspect-4/5">
                    {collection.invitation && (
                      <Image
                        alt=""
                        className="object-contain transition-transform duration-500 group-hover/tile:-translate-y-1 motion-reduce:transition-none"
                        fill
                        sizes="100vw"
                        src={collection.invitation}
                      />
                    )}
                  </span>
                  {collection.name}
                </StudioLink>
              </li>
            ))}
          </ul>
          <p className="reveal text-[0.5625rem] tracking-[0.09em] uppercase" data-reveal>
            {collections.length} colecții de botez, gata de personalizat
          </p>
        </div>
        <div className="grid pb-10 md:py-14">
          <div
            className="reveal reveal-curtain relative min-h-120 overflow-hidden rounded-t-[14.375rem] md:min-h-148"
            data-reveal
          >
            <Image
              alt="O invitație de botez cu un ursuleț adormit pe lună, lângă un pergament legat cu panglică și sigiliu, pe o masă cu lumânări și rame aurii"
              className="translate-y-[var(--scroll-shift,0px)] scale-[1.13] object-cover"
              fill
              placeholder="blur"
              sizes="100vw"
              src={christening}
            />
            <p
              className="absolute inset-x-6 bottom-7.5 -rotate-4 bg-background/90 p-5 text-center font-display text-[1.625rem] leading-[1.2] italic transition-transform duration-300 ease-out [transform:perspective(1000px)_rotateX(var(--tilt-y,0deg))_rotateY(var(--tilt-x,0deg))]"
              data-tilt
            >
              Cu drag,
              <br />
              pentru cei mici.
            </p>
          </div>
        </div>
      </div>
    </Container>
  );
}
