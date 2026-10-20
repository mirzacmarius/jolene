"use client";

import { type ReactNode, useRef } from "react";

import { Tabs } from "@/components/ui/tabs";

interface CollectionPickerProps {
  children: ReactNode;
  className?: string;
  defaultValue: string;
}

// Below lg the chosen collection's card sits under the list, so a choice brings it into view.
export function CollectionPicker({ children, className, defaultValue }: CollectionPickerProps) {
  const root = useRef<HTMLDivElement>(null);

  return (
    <Tabs
      className={className}
      data-reveal
      defaultValue={defaultValue}
      onValueChange={(_, details) => {
        if (details.reason !== "none" || matchMedia("(min-width: 64rem)").matches) return;
        requestAnimationFrame(() => {
          root.current
            ?.querySelector<HTMLElement>('[data-slot="tabs-content"]:not([hidden])')
            ?.scrollIntoView({
              behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
              block: "start",
            });
        });
      }}
      orientation="vertical"
      ref={root}
    >
      {children}
    </Tabs>
  );
}
