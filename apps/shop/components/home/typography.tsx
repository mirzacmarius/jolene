import { cn } from "cn";
import type { ComponentProps } from "react";

export function Accent({ className, ...props }: ComponentProps<"em">) {
  return (
    <em
      className={cn("font-display font-normal tracking-[-0.025em] italic", className)}
      {...props}
    />
  );
}

export function Eyebrow({ className, ...props }: ComponentProps<"p">) {
  return (
    <p
      className={cn("text-xxs leading-[1.6] font-medium tracking-[0.15em] uppercase", className)}
      {...props}
    />
  );
}
