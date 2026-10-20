// Adapted from Marée by LN (MIT License): see THIRD-PARTY-NOTICES.md.
"use client";

import { cn } from "cn";
import { PauseIcon, PlayIcon } from "lucide-react";
import { Fragment, useState } from "react";

interface MarqueeProps {
  className?: string;
  items: string[];
  pauseLabel: string;
  resumeLabel: string;
  separator: string;
}

// Two identical groups, each at least as wide as the viewport, make the loop seamless at any width.
export function Marquee({ className, items, pauseLabel, resumeLabel, separator }: MarqueeProps) {
  const [paused, setPaused] = useState(false);

  return (
    <div className={cn("group/marquee relative isolate", className)} data-paused={paused}>
      <p className="sr-only">{items.join(" · ")}</p>
      <div
        aria-hidden="true"
        className="overflow-hidden [mask-image:linear-gradient(to_right,#000_calc(100%_-_4.75rem),transparent_calc(100%_-_3rem))] motion-reduce:[mask-image:none]"
      >
        <div className="flex w-max group-focus-within/marquee:[animation-play-state:paused] group-hover/marquee:[animation-play-state:paused] group-data-[paused=true]/marquee:[animation-play-state:paused] motion-safe:animate-marquee motion-reduce:w-full">
          {[0, 1].map((copy) => (
            <div
              className="flex w-max min-w-screen shrink-0 items-center justify-around gap-5 px-2.5 whitespace-nowrap md:gap-10 md:px-5 motion-reduce:w-full motion-reduce:min-w-0 motion-reduce:flex-wrap motion-reduce:justify-center motion-reduce:gap-x-5 motion-reduce:gap-y-2.5 motion-reduce:whitespace-normal motion-reduce:not-first:hidden"
              key={copy}
            >
              {items.map((item) => (
                <Fragment key={item}>
                  <span>{item}</span>
                  <span className="shrink-0 text-gold motion-reduce:hidden">{separator}</span>
                </Fragment>
              ))}
            </div>
          ))}
        </div>
      </div>
      <button
        aria-label={pauseLabel}
        aria-pressed={paused}
        className="absolute top-1/2 right-2.5 z-10 grid size-11 -translate-y-1/2 cursor-pointer place-items-center rounded-full border border-current/35 bg-background transition-colors outline-none hover:border-current focus-visible:ring-3 focus-visible:ring-ring/50 motion-reduce:hidden"
        onClick={() => setPaused((value) => !value)}
        title={paused ? resumeLabel : pauseLabel}
        type="button"
      >
        {paused ? (
          <PlayIcon aria-hidden="true" className="size-3.5" />
        ) : (
          <PauseIcon aria-hidden="true" className="size-3.5" />
        )}
      </button>
    </div>
  );
}
