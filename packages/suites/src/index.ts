import { forest } from "./forest";
import type { Suite } from "./suite";
import { teddyInBalon } from "./teddy-in-balon";

export {
  type Artwork,
  artLayer,
  type Suite,
  type SuiteTemplate,
} from "./suite";

/** Jolene's collections, in the order the gallery shows them. */
export const suites: Suite[] = [forest, teddyInBalon];
