import { cn } from "cn";

import { Container } from "@/components/ui/container";
import { Marquee } from "@/components/ui/marquee";

import { PillArrow, textLinkClassName } from "./pill";
import { Accent, Eyebrow } from "./typography";

export function HomeStrip() {
  return (
    <Marquee
      className="border-b py-7.5 text-[0.6875rem] leading-normal tracking-[0.16em] uppercase md:text-xs"
      items={[
        "Invitații",
        "Carduri de confirmare",
        "Meniuri",
        "Place carduri",
        "Numere de masă",
        "Tablouri de întâmpinare",
        "Tablouri de așezare",
        "Plicuri de bani",
        "Etichete pentru mărturii",
      ]}
      pauseLabel="Opriți textul care se derulează"
      resumeLabel="Reluați textul care se derulează"
      separator="✦"
    />
  );
}

export function HomeStory() {
  return (
    <Container aria-labelledby="story-title" className="scroll-mt-16" data-scene id="poveste">
      <div className="grid gap-10 py-24 md:grid-cols-[1.25fr_1fr] md:py-30">
        <div className="grid content-start justify-items-start gap-5">
          <Eyebrow className="reveal" data-reveal>
            Un singur stil, de la invitație la plicul de bani
          </Eyebrow>
          <h2
            className="reveal reveal-blur text-[clamp(2.75rem,5vw,5rem)] leading-[1.07] font-normal tracking-[-0.06em]"
            data-reveal
            id="story-title"
          >
            Fiecare detaliu
            <br />
            <Accent>se potrivește.</Accent>
          </h2>
          <Rosette className="size-14 rotate-[var(--scroll-turn,0deg)] text-gold transition-transform duration-1000 hover:[transform:rotate(120deg)] motion-reduce:transition-none" />
        </div>
        <div className="grid content-start justify-items-start gap-5 md:pt-11">
          <p className="reveal max-w-sm text-[0.9375rem] leading-[1.9]" data-reveal>
            Jolene desenează în acuarelă colecții întregi pentru nuntă și botez: invitația, meniul,
            numerele de masă, plicurile de bani și tot ce mai așezați pe mese, în același stil.
          </p>
          <p
            className="reveal max-w-sm text-[0.8125rem] leading-[1.9] text-muted-foreground"
            data-reveal
          >
            Acum le personalizați singuri, în studio: scrieți numele, data și locurile, alegeți
            hârtia, culorile și finisajele, iar previzualizarea realistă vă arată totul așa cum va
            ieși de sub tipar.
          </p>
          <a className={cn("reveal", textLinkClassName)} data-reveal href="#colectii">
            Vedeți colecțiile <PillArrow />
          </a>
        </div>
      </div>
    </Container>
  );
}

function Rosette({ className }: { className: string }) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1"
      viewBox="0 0 56 56"
    >
      {[0, 45, 90, 135].map((angle) => (
        <ellipse
          cx="28"
          cy="28"
          key={angle}
          rx="6.5"
          ry="25"
          transform={`rotate(${angle} 28 28)`}
        />
      ))}
      <circle cx="28" cy="28" r="3.5" />
    </svg>
  );
}
