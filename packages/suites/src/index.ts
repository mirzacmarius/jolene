import { autumn } from "./autumn";
import { boho } from "./boho";
import { carusel } from "./carusel";
import { classicRoses } from "./classic-roses";
import { eucalipt } from "./eucalipt";
import { forest } from "./forest";
import { geometricFlowers } from "./geometric-flowers";
import { royalBlue } from "./royal-blue";
import { safari } from "./safari";
import type { Suite } from "./suite";
import { teddyInBalon } from "./teddy-in-balon";

export { forest } from "./forest";
export {
  type Artwork,
  artLayer,
  type Suite,
  type SuiteTemplate,
} from "./suite";

/** Jolene's collections, in the order the gallery shows them. */
export const suites: Suite[] = [
  forest,
  eucalipt,
  royalBlue,
  geometricFlowers,
  classicRoses,
  autumn,
  teddyInBalon,
  carusel,
  safari,
  boho,
];
