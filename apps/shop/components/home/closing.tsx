import { StudioLink } from "@/components/studio/studio-link";

import { PillArrow, pillVariants } from "./pill";
import { Accent, Eyebrow } from "./typography";

export function HomeClosing() {
  return (
    <section
      aria-labelledby="closing-title"
      className="relative isolate overflow-hidden bg-sage px-5 py-28 text-center"
      data-scene
    >
      <div aria-hidden="true" className="absolute inset-0 -z-10 grid place-items-center">
        <i className="absolute h-1/2 w-[85%] -rotate-15 translate-x-[var(--scroll-shift,0px)] rounded-[50%] border border-primary/12" />
        <i className="absolute h-[70%] w-[110%] -rotate-15 translate-x-[calc(var(--scroll-shift,0px)_*_-1)] rounded-[50%] border border-primary/12" />
        <i className="absolute h-[90%] w-[135%] -rotate-15 translate-x-[var(--scroll-shift,0px)] rounded-[50%] border border-primary/12" />
      </div>
      <div className="grid justify-items-center gap-10">
        <Eyebrow className="reveal" data-reveal>
          Ziua voastră merită o invitație pe măsură
        </Eyebrow>
        <h2
          className="reveal reveal-blur text-[clamp(4.25rem,10.5vw,10rem)] leading-[0.95] font-normal tracking-[-0.06em]"
          data-reveal
          id="closing-title"
        >
          Să începem
          <br />
          <Accent>cu drag.</Accent>
        </h2>
        <div className="reveal" data-reveal>
          <StudioLink className={pillVariants()}>
            Creați-vă invitația <PillArrow />
          </StudioLink>
        </div>
        <p className="reveal text-[0.5625rem] tracking-[0.12em] uppercase" data-reveal>
          Jolene · Papetărie de nuntă și botez · Iași
        </p>
      </div>
    </section>
  );
}
