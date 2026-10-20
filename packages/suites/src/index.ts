import { boho } from "./boho";
import { forest } from "./forest";
import { safari } from "./safari";
import type { Suite } from "./suite";

export {
  type Artwork,
  artLayer,
  type Suite,
  type SuiteTemplate,
} from "./suite";

/** Jolene's collections, in the order the gallery shows them. */
export const suites: Suite[] = [forest, safari, boho];
