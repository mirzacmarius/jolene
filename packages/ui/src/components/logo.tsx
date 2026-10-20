import type { ComponentProps } from "react";
import { cn } from "../utils";
import logo from "./jolene-logo.webp";

/**
 * Jolene's logo, the watercolour rose and the wordmark, made from
 * brand/jolene-logo.png by brand/generate.py. The file is over three times
 * the height it's drawn at, so it stays sharp on every screen.
 */
export function Logo({ className, ...props }: ComponentProps<"img">) {
  return (
    <img
      src={logo.src}
      width={logo.width}
      height={logo.height}
      alt="Jolene"
      className={cn("h-10 w-auto", className)}
      {...props}
    />
  );
}
