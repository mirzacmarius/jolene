import { autumn } from "./autumn";
import { boho } from "./boho";
import { classicRoses } from "./classic-roses";
import { forest } from "./forest";
import { safari } from "./safari";
import type { Suite } from "./suite";

export { forest } from "./forest";
export {
  type Artwork,
  artLayer,
  type Suite,
  type SuiteTemplate,
} from "./suite";

/** Jolene's collections, in the order the gallery shows them. */
export const suites: Suite[] = [forest, classicRoses, autumn, safari, boho];
