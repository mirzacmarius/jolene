import "@jolene/ui/globals.css";
import { googleFontsHref } from "@jolene/design";
import { defaultLocale, isLocale } from "@jolene/i18n";
import { Toaster } from "@jolene/ui/toaster";
import { cn } from "@jolene/ui/utils";
import { Cormorant_Garamond, Jost } from "next/font/google";
import type { ReactNode } from "react";
import { ConvexClientProvider } from "@/app/convex-client-provider";
import { I18nProvider } from "@/locales/client";
import { dictionaries } from "@/locales/dictionaries";
import { getI18n, getStaticParams } from "@/locales/server";

// Latin Extended carries Romanian's ă, â, î, ș and ț.
const sans = Jost({
  subsets: ["latin", "latin-ext"],
  variable: "--font-sans",
  display: "swap",
});
const display = Cormorant_Garamond({
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500", "600"],
  style: ["normal", "italic"],
  variable: "--font-display",
  display: "swap",
});

/** Every language is prerendered, so each page has a static shell to serve. */
export function generateStaticParams() {
  return getStaticParams();
}

export async function generateMetadata() {
  const t = await getI18n();
  return {
    title: { default: t("common.appName"), template: "%s · Jolene" },
    description: t("common.description"),
  };
}

export const viewport = { themeColor: "#fbf8f3" };

export default async function RootLayout({
  children,
  params,
}: Readonly<{ children: ReactNode; params: Promise<{ locale: string }> }>) {
  const requested = (await params).locale;
  const locale = isLocale(requested) ? requested : defaultLocale;
  const dictionary = dictionaries[locale];
  return (
    <html lang={locale}>
      <head>
        {/* The typefaces designs are set in, under their own names, for the
            SVG previews. A family downloads only once a design uses it. */}
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
        <I18nProvider locale={locale} dictionary={dictionary}>
          <ConvexClientProvider>{children}</ConvexClientProvider>
        </I18nProvider>
        <Toaster />
      </body>
    </html>
  );
}
