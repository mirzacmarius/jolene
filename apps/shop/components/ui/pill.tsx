import { cva } from "class-variance-authority";
import { ArrowUpRightIcon } from "lucide-react";

export const pillVariants = cva(
  "group/pill inline-flex min-h-13 cursor-pointer items-center justify-between gap-10 rounded-full px-6.5 py-4 text-sm leading-tight outline-none transition-[background-color,translate,scale] duration-250 hover:-translate-y-0.5 focus-visible:ring-3 focus-visible:ring-ring/50 active:scale-98 motion-reduce:hover:translate-y-0 motion-reduce:active:scale-100",
  {
    defaultVariants: { tone: "dark" },
    variants: {
      tone: {
        dark: "bg-primary text-primary-foreground hover:bg-primary/90",
        light: "bg-background text-foreground hover:bg-secondary",
      },
    },
  },
);

export const textLinkClassName =
  "group/pill inline-flex min-h-11 items-center gap-5 border-b border-current text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50";

export function PillArrow() {
  return (
    <ArrowUpRightIcon
      aria-hidden="true"
      className="size-5 shrink-0 stroke-[1.25] transition-transform duration-250 group-hover/pill:translate-x-0.75 group-hover/pill:-translate-y-0.75 motion-reduce:transition-none"
    />
  );
}
