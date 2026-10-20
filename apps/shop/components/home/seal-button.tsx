// Adapted from Marée by LN (MIT License): see THIRD-PARTY-NOTICES.md.
"use client";

import { useState } from "react";

interface SealButtonProps {
  label: string;
  lines: [string, string];
}

export function SealButton({ label, lines }: SealButtonProps) {
  const [presses, setPresses] = useState(0);

  return (
    <button
      aria-label={label}
      className="group/seal relative w-26 shrink-0 rotate-7 cursor-pointer rounded-t-full border border-primary-foreground/50 px-3 pt-3.5 pb-3 text-center outline-none focus-visible:ring-3 focus-visible:ring-primary-foreground/60"
      onClick={() => setPresses((count) => count + 1)}
      type="button"
    >
      <svg
        aria-hidden="true"
        className="mx-auto mb-2 size-11 transition-transform duration-500 group-hover/seal:-translate-y-0.5 group-active/seal:scale-90 motion-reduce:transition-none"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.25"
        viewBox="0 0 48 48"
      >
        <path d="M24 5c3 0 4.6 2.4 7.4 3.2 2.9.8 5.6-.3 7.6 2s.9 4.9 2 7.6S45 21 45 24s-2.4 4.6-3.2 7.4c-.8 2.9.3 5.6-2 7.6s-4.9.9-7.6 2S27 45 24 45s-4.6-2.4-7.4-3.2c-2.9-.8-5.6.3-7.6-2s-.9-4.9-2-7.6S3 27 3 24s2.4-4.6 3.2-7.4c.8-2.9-.3-5.6 2-7.6s4.9-.9 7.6-2S21 5 24 5Z" />
        <circle cx="24" cy="24" r="12" />
        <path d="M24 30.5s-6-3.6-6-7.6a3.3 3.3 0 0 1 6-1.9 3.3 3.3 0 0 1 6 1.9c0 4-6 7.6-6 7.6Z" />
      </svg>
      <span className="block text-[0.5625rem] leading-[1.7] tracking-[0.12em] uppercase">
        {lines[0]}
        <br />
        {lines[1]}
      </span>
      {presses > 0 && (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute top-1/3 left-1/2 motion-reduce:hidden"
          key={presses}
        >
          {[0, 180, 360].map((delay) => (
            <i
              className="absolute -top-11 -left-11 size-22 animate-ring rounded-full border border-primary-foreground/60"
              key={delay}
              style={{ animationDelay: `${delay}ms` }}
            />
          ))}
        </span>
      )}
    </button>
  );
}
