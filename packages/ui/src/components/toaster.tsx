"use client";

import { useTheme } from "next-themes";
import { Toaster as Sonner, toast } from "sonner";

export { toast };

export function Toaster() {
  const { resolvedTheme } = useTheme();
  return (
    <Sonner
      theme={resolvedTheme === "dark" ? "dark" : "light"}
      position="bottom-center"
      toastOptions={{
        classNames: {
          toast: "!rounded-xl !border-border !bg-card !text-card-foreground",
        },
      }}
    />
  );
}
