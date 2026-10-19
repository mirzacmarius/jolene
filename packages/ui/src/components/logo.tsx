import type { ComponentProps } from "react";
import { cn } from "../utils";

/** The Jolene wordmark, set in the display serif with a gold sprig. */
export function Logo({ className, ...props }: ComponentProps<"span">) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 font-display text-[1.6rem] leading-none tracking-wide",
        className,
      )}
      {...props}
    >
      <svg
        viewBox="0 0 24 24"
        aria-hidden="true"
        className="size-[0.9em] text-gold"
        fill="currentColor"
      >
        <path
          d="M12 21c-.4-3.6.3-7.4 2.6-10.6C16.4 8 19 6.4 21.5 6c-.7 2.7-2.2 5.1-4.6 6.8-1.6 1.1-3.4 1.8-4.9 2.2"
          opacity="0.9"
        />
        <path
          d="M11.4 16.5C9.6 15 8.4 12.7 8.3 10.1c-.1-2 .5-4.1 1.8-5.7 1 1.9 1.5 4 1.3 6.1-.1 1.6-.6 3.2-1.4 4.6"
          opacity="0.6"
        />
      </svg>
      <span>Jolene</span>
    </span>
  );
}
