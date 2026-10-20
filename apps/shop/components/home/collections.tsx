import type { Occasion } from "@jolene/design";
import { suites } from "@jolene/suites";
import type { StaticImageData } from "next/image";

import autumn from "./collections/autumn.webp";
import boho from "./collections/boho.webp";
import carusel from "./collections/carusel.webp";
import classicRoses from "./collections/classic-roses.webp";
import eucalipt from "./collections/eucalipt.webp";
import forest from "./collections/forest.webp";
import geometricFlowers from "./collections/geometric-flowers.webp";
import royalBlue from "./collections/royal-blue.webp";
import safari from "./collections/safari.webp";
import teddyInBalon from "./collections/teddy-in-balon.webp";

// packages/suites/preview/shots.ts draws each collection's invitation into ./collections.
const INVITATIONS: Record<string, StaticImageData> = {
  autumn,
  boho,
  carusel,
  "classic-roses": classicRoses,
  eucalipt,
  forest,
  "geometric-flowers": geometricFlowers,
  "royal-blue": royalBlue,
  safari,
  "teddy-in-balon": teddyInBalon,
};

export interface HomeCollection {
  invitation?: StaticImageData;
  name: string;
  slug: string;
}

export function getHomeCollections(occasion: Occasion): HomeCollection[] {
  return suites
    .filter((suite) => suite.occasion === occasion)
    .map((suite) => ({
      invitation: INVITATIONS[suite.slug],
      name: suite.name.ro,
      slug: suite.slug,
    }));
}
