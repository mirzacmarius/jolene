import { cn } from "cn";

import { PillArrow, textLinkClassName } from "@/components/ui/pill";

import { Accent, Eyebrow } from "./typography";

export function HomeDelivery() {
  return (
    <section
      aria-labelledby="delivery-title"
      className="relative isolate overflow-hidden bg-primary px-5 py-24 text-primary-foreground md:py-28"
      data-scene
    >
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-10 grid scale-[calc(1_+_var(--scroll-progress,0)_*_0.08)] place-items-center"
      >
        {["size-82", "size-110", "size-138", "size-166"].map((size) => (
          <i
            className={cn("absolute rounded-full border border-primary-foreground/15", size)}
            key={size}
          />
        ))}
      </div>
      <div className="mx-auto grid max-w-xl justify-items-center gap-5 text-center">
        <Eyebrow className="reveal text-gold" data-reveal>
          După bunul de tipar
        </Eyebrow>
        <h2
          className="reveal reveal-blur text-[clamp(2.5rem,4.5vw,3.75rem)] leading-[1.1] font-normal tracking-[-0.06em]"
          data-reveal
          id="delivery-title"
        >
          În <Accent>7 zile lucrătoare,</Accent>
          <br />
          la voi acasă.
        </h2>
        <p
          className="reveal max-w-md text-[0.8125rem] leading-[1.9] text-primary-foreground/80"
          data-reveal
        >
          Atât durează, cel mult, să tipărim, să asamblăm și să vă trimitem comanda, în funcție de
          cantitate și de finisaje.
        </p>
        <a className={cn("reveal", textLinkClassName)} data-reveal href="#intrebari">
          Bine de știut <PillArrow />
        </a>
      </div>
    </section>
  );
}
