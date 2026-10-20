import { ArrowDownIcon } from "lucide-react";
import Image from "next/image";

import { StudioLink } from "@/components/studio/studio-link";

import forestSuite from "./photos/forest-suite.jpg";
import { PillArrow, pillVariants } from "./pill";
import { SealButton } from "./seal-button";
import { Accent, Eyebrow } from "./typography";

export function HomeHero() {
  return (
    <section aria-labelledby="home-title" className="px-2.5 md:px-4">
      <div
        className="relative isolate grid h-[min(47.5rem,calc(100svh_-_4.75rem))] min-h-155 grid-rows-[1fr_auto] gap-5 overflow-hidden rounded-md px-5 pt-10 pb-7 text-primary-foreground md:px-9"
        data-scene
      >
        <Image
          alt="Colecția Forest pe catifea verde: invitația cu o pădure în acuarelă, plicul închis cu un sigiliu verde din ceară, cardul de mulțumire și un trandafir alb"
          className="-z-20 translate-y-[var(--scroll-shift,0px)] scale-[1.12] object-cover object-[center_45%] saturate-60 motion-safe:animate-settle"
          fetchPriority="high"
          fill
          loading="eager"
          placeholder="blur"
          preload
          sizes="100vw"
          src={forestSuite}
        />
        <div className="absolute inset-0 -z-10 bg-primary/70" />
        <div className="grid justify-items-center gap-5 self-center text-center">
          <Eyebrow className="motion-safe:animate-rise">
            Invitații de nuntă și botez · desenate în acuarelă
          </Eyebrow>
          <h1
            className="py-2.5 text-[clamp(3.25rem,8.8vw,9rem)] leading-[0.98] font-normal tracking-[-0.06em] text-balance motion-safe:animate-rise"
            id="home-title"
          >
            Povestea voastră,
            <br />
            <Accent>pe hârtie.</Accent>
          </h1>
          <p className="max-w-md pb-2.5 text-[0.9375rem] leading-[1.8] motion-safe:animate-rise motion-safe:[animation-delay:150ms]">
            Alegeți o colecție, scrieți-vă numele și vedeți invitația exact cum va arăta tipărită,
            înainte s-o comandați.
          </p>
          <StudioLink
            className={pillVariants({
              className: "min-w-56 motion-safe:animate-rise motion-safe:[animation-delay:250ms]",
              tone: "light",
            })}
          >
            Creați-vă invitația <PillArrow />
          </StudioLink>
        </div>
        <div className="flex items-end justify-between gap-5">
          <span className="hidden text-[0.5625rem] leading-[1.7] tracking-[0.12em] uppercase sm:block">
            Desenate în acuarelă.
            <br />
            Tipărite în atelierul Jolene.
          </span>
          <a
            className="flex min-h-11 items-center gap-5 text-[0.625rem] tracking-[0.12em] uppercase outline-none focus-visible:ring-3 focus-visible:ring-primary-foreground/60"
            href="#poveste"
          >
            Descoperiți colecțiile
            <ArrowDownIcon aria-hidden="true" className="size-5 stroke-[1.25]" />
          </a>
          <SealButton label="Pecetluiți cu drag" lines={["Pecetluiți", "cu drag."]} />
        </div>
      </div>
    </section>
  );
}
