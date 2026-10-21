import "@jolene/ui/globals.css";
import { googleFontsHref } from "@jolene/design";
import { Toaster } from "@jolene/ui/toaster";
import { cn } from "@jolene/ui/utils";
import type { ReactNode } from "react";
import { display, sans } from "@/app/fonts";

export const viewport = { themeColor: "#fbf8f3" };

/**
 * The page guests open an invitation on, at invitatie.jolene.ro: a layout of
 * its own, without the studio's header or its sign-in. Its language is the
 * invitation's, which the page sets once it knows it; Romanian until then.
 */
export default function GuestLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="ro">
      <head>
        {/* The typefaces the couple's design is set in, for its preview. */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin=""
        />
        <link rel="stylesheet" href={googleFontsHref()} />
      </head>
      <body
        className={cn(sans.variable, display.variable, "font-sans antialiased")}
      >
        {children}
        <Toaster />
      </body>
    </html>
  );
}
