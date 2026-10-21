import { Button } from "@jolene/ui/button";
import type { ComponentProps, ReactNode } from "react";

/** A small button with only an icon, named for those who can't see it. */
export function IconButton({
  label,
  children,
  ...props
}: { label: string; children: ReactNode } & Omit<
  ComponentProps<typeof Button>,
  "type" | "variant" | "size" | "aria-label" | "title"
>) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className="size-8"
      aria-label={label}
      title={label}
      {...props}
    >
      {children}
    </Button>
  );
}
