import { cn } from "cn";
import type { ComponentProps } from "react";

export function Accent({ className, ...props }: ComponentProps<"em">) {
  return (
    <em
      className={cn("font-display text-[1.12em] font-medium tracking-[-0.025em] italic", className)}
      {...props}
    />
  );
}

export function Eyebrow({ className, ...props }: ComponentProps<"p">) {
  return (
    <p
      className={cn("text-[0.6875rem] font-medium tracking-[0.15em] uppercase", className)}
      {...props}
    />
  );
}
