import type { ReactNode } from "react";

import { Container } from "@/components/ui/container";

import { Eyebrow } from "./typography";

const FINISHES: { icon: ReactNode; lines: [string, string]; title: string }[] = [
  {
    icon: (
      <>
        <path d="M24 5c3 0 4.6 2.4 7.4 3.2 2.9.8 5.6-.3 7.6 2s.9 4.9 2 7.6S45 21 45 24s-2.4 4.6-3.2 7.4c-.8 2.9.3 5.6-2 7.6s-4.9.9-7.6 2S27 45 24 45s-4.6-2.4-7.4-3.2c-2.9-.8-5.6.3-7.6-2s-.9-4.9-2-7.6S3 27 3 24s2.4-4.6 3.2-7.4c.8-2.9-.3-5.6 2-7.6s4.9-.9 7.6-2S21 5 24 5Z" />
        <circle cx="24" cy="24" r="12" />
        <path d="M19 28.5V19.5l5 6 5-6v9" />
      </>
    ),
    lines: ["Cu inițialele voastre sau un motiv,", "în culoarea nunții."],
    title: "Sigiliu din ceară.",
  },
  {
    icon: (
      <>
        <path d="M21 4c1.2 9.5 4.5 12.8 14 14-9.5 1.2-12.8 4.5-14 14-1.2-9.5-4.5-12.8-14-14 9.5-1.2 12.8-4.5 14-14Z" />
        <path d="M37 29c.6 4.8 2.2 6.4 7 7-4.8.6-6.4 2.2-7 7-.6-4.8-2.2-6.4-7-7 4.8-.6 6.4-2.2 7-7Z" />
      </>
    ),
    lines: ["Auriu, argintiu, rose gold sau cupru,", "pe nume și pe liniile fine."],
    title: "Folio care prinde lumina.",
  },
  {
    icon: (
      <>
        <rect height="34" rx="1" width="24" x="7" y="7" />
        <path d="M17 12h24v34H17z" opacity="0.55" />
        <path d="M17 26h24" />
        <circle cx="29" cy="26" r="4" />
      </>
    ),
    lines: ["Un voal transparent peste invitație,", "legat cu satin, catifea sau dantelă."],
    title: "Foaie de calc și panglici.",
  },
];

export function HomeFinishes() {
  return (
    <div className="border-b">
      <Container aria-label="Finisaje">
        <div className="grid gap-10 py-15 text-center md:pb-19">
          <Eyebrow className="reveal text-[0.5625rem] text-muted-foreground" data-reveal>
            Detaliile care se simt în mână
          </Eyebrow>
          <div className="grid gap-10 md:grid-cols-3 md:gap-0">
            {FINISHES.map((finish) => (
              <article
                className="group/finish reveal grid justify-items-center gap-4 not-first:border-t not-first:pt-10 md:px-7.5 md:not-first:border-t-0 md:not-first:border-l md:not-first:pt-0"
                data-reveal
                key={finish.title}
              >
                <svg
                  aria-hidden="true"
                  className="size-12 text-gold transition-[rotate,translate] duration-700 group-hover/finish:-translate-y-1.75 group-hover/finish:rotate-12 motion-reduce:transition-none"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1"
                  viewBox="0 0 48 48"
                >
                  {finish.icon}
                </svg>
                <h3 className="text-[1.4375rem] tracking-[-0.035em]">{finish.title}</h3>
                <p className="text-xs leading-[1.8] text-muted-foreground">
                  {finish.lines[0]}
                  <br />
                  {finish.lines[1]}
                </p>
              </article>
            ))}
          </div>
        </div>
      </Container>
    </div>
  );
}
