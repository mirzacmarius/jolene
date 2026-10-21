import { Cormorant_Garamond, Jost } from "next/font/google";

/**
 * The studio's typefaces, for its pages and for guests' invitations. Latin
 * Extended carries Romanian's ă, â, î, ș and ț.
 */
export const sans = Jost({
  subsets: ["latin", "latin-ext"],
  variable: "--font-sans",
  display: "swap",
});

export const display = Cormorant_Garamond({
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500", "600"],
  style: ["normal", "italic"],
  variable: "--font-display",
  display: "swap",
});
