"use client";

import { cn } from "@jolene/ui/utils";
import { useEffect, useState } from "react";
import { useI18n } from "@/locales/client";

/** How long the envelope takes to open before the invitation shows. */
const OPENING_MS = 1500;

export type EnvelopeStage = "closed" | "opening" | "open";

/**
 * The envelope a digital invitation arrives in, with the family's name and
 * a seal in the design's colour: a tap lifts the flap, the card slides out,
 * and the invitation shows. A visitor who asks for less motion goes straight
 * to it.
 */
export function Envelope({
  name,
  seal,
  sealColor,
  background,
  onOpen,
}: {
  /** The family's name; none through the open link. */
  name: string | null;
  /** The couple's initials, on the seal. */
  seal: string;
  sealColor: string;
  background: string;
  onOpen: () => void;
}) {
  const t = useI18n();
  const [stage, setStage] = useState<EnvelopeStage>("closed");

  useEffect(() => {
    if (stage !== "opening") return;
    const done = setTimeout(onOpen, OPENING_MS);
    return () => clearTimeout(done);
  }, [stage, onOpen]);

  const open = () => {
    if (stage !== "closed") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) onOpen();
    else setStage("opening");
  };
  const opening = stage === "opening";

  return (
    <div
      className={cn(
        "fixed inset-0 z-40 flex flex-col items-center justify-center gap-10 px-6 transition-opacity duration-500",
        opening && "pointer-events-none opacity-0 delay-1000",
      )}
      style={{ background }}
    >
      <button
        type="button"
        onClick={open}
        aria-label={t("guest.tapToOpen")}
        className="group relative w-[min(86vw,440px)] cursor-pointer outline-none [perspective:1200px] focus-visible:ring-4 focus-visible:ring-white/60"
        style={{ aspectRatio: "162 / 114" }}
      >
        {/* The envelope's inside, behind the card. */}
        <span
          aria-hidden
          className="absolute inset-0 rounded-[3px] bg-[#e9e1d3] shadow-[0_30px_60px_-20px_rgba(40,30,20,0.45)]"
        />
        {/* The card, sliding out as it opens. */}
        <span
          aria-hidden
          className={cn(
            "absolute inset-x-[6%] top-[5%] bottom-[5%] rounded-[2px] bg-[#fdfbf7] shadow-sm transition-transform duration-700 ease-out",
            opening && "-translate-y-[58%] delay-500",
          )}
        />
        {/* The front, a pocket the card sits in. */}
        <span
          aria-hidden
          className="absolute inset-0 rounded-[3px] bg-[#f3ede2]"
          style={{
            clipPath: "polygon(0 0, 50% 52%, 100% 0, 100% 100%, 0 100%)",
          }}
        />
        {/* The flap, folding up and back. */}
        <span
          aria-hidden
          className={cn(
            "absolute inset-x-0 top-0 h-[58%] origin-top bg-[#efe7da] transition-transform duration-500 ease-in-out [backface-visibility:hidden]",
            opening
              ? "[transform:rotateX(180deg)]"
              : "group-hover:[transform:rotateX(14deg)]",
          )}
          style={{
            clipPath: "polygon(0 0, 100% 0, 50% 100%)",
            filter: "drop-shadow(0 2px 2px rgba(40,30,20,0.12))",
          }}
        />
        {/* The seal on the flap's point. */}
        <span
          aria-hidden
          className={cn(
            "absolute top-[58%] left-1/2 flex size-[19%] -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full font-display text-[clamp(14px,4.4vw,22px)] text-white/90 italic shadow-[inset_0_-3px_6px_rgba(0,0,0,0.25),0_3px_6px_rgba(40,30,20,0.3)] transition-opacity duration-300",
            opening && "opacity-0",
          )}
          style={{ backgroundColor: sealColor }}
        >
          {seal}
        </span>
      </button>
      <div
        className={cn(
          "flex flex-col items-center gap-3 text-center transition-opacity duration-300",
          opening && "opacity-0",
        )}
      >
        {name ? (
          <p className="font-display text-3xl text-[#2b2622] sm:text-4xl">
            {t("guest.forName", { name })}
          </p>
        ) : null}
        <p className="text-sm tracking-wide text-[#2b2622]/70">
          {t("guest.tapToOpen")}
        </p>
      </div>
    </div>
  );
}
