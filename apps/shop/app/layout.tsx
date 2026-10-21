import type { Metadata, Viewport } from "next";
import { DM_Sans, Geist_Mono, Instrument_Serif } from "next/font/google";

import "./globals.css";
import { Suspense } from "react";

import { AnalyticsComponents } from "@/components/analytics";
import { CartUI } from "@/components/cart/cart-ui";
import { Footer } from "@/components/footer";
import { Nav } from "@/components/nav";
import { SiteSchema } from "@/components/schema/site-schema";
import { CartProvider } from "@/lib/cart/client";
import { getCart } from "@/lib/cart/server";
import { shopConfig } from "@/lib/config";
import { buildAlternates } from "@/lib/seo";

export const ensureStatic = "prefetch";

export const viewport: Viewport = {
  themeColor: "#fbf8f3",
};

const dmSans = DM_Sans({
  axes: ["opsz"],
  subsets: ["latin", "latin-ext"],
  variable: "--font-dm-sans",
});

// Only Instrument Serif's italic is loaded: font-display is for italic accents.
const instrumentSerif = Instrument_Serif({
  style: "italic",
  subsets: ["latin", "latin-ext"],
  variable: "--font-instrument-serif",
  weight: "400",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export default function RootLayout({ children }: LayoutProps<"/">) {
  // Un-awaited: the promise streams to the client provider; never block the shell on it.
  const cart = getCart();
  return (
    <html lang={shopConfig.localization.locale}>
      <body
        className={`${dmSans.variable} ${instrumentSerif.variable} ${geistMono.variable} flex min-h-dvh flex-col font-sans antialiased`}
      >
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-100 focus:rounded-md focus:bg-background focus:px-5 focus:py-2 focus:text-sm focus:font-medium focus:shadow-lg focus:ring-2 focus:ring-foreground focus:outline-none"
        >
          Sari la conținut
        </a>
        <SiteSchema />

        <CartProvider cart={cart}>
          <Nav />
          <main id="main-content" className="flex flex-1 flex-col min-w-0">
            {children}
          </main>
          <Footer />
          <CartUI />
          <Suspense>
            <AnalyticsComponents />
          </Suspense>
        </CartProvider>
      </body>
    </html>
  );
}

export const generateMetadata = async (): Promise<Metadata> => {
  return {
    alternates: buildAlternates({ pathname: "/" }),
    description: shopConfig.site.description,
    generator: shopConfig.site.name,
    metadataBase: new URL(shopConfig.site.url),
    openGraph: {
      images: [{ alt: shopConfig.site.name, height: 630, url: "/og-default.png", width: 1200 }],
    },
    title: {
      default: shopConfig.site.name,
      template: `%s | ${shopConfig.site.name}`,
    },
    twitter: {
      card: "summary_large_image",
    },
  };
};
