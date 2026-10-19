import type {
  DesignDocumentInput,
  Fields,
  Frame,
  Labels,
  LayerInput,
  Occasion,
} from "@jolene/design";

/**
 * A file one of Jolene's collections draws. The studio serves it from its own
 * public folder, so every deployment has it without uploading anything.
 */
export interface Artwork {
  /** Where the studio serves the file. */
  path: string;
  /** What the layers panel calls it. */
  name: string;
  /** Where it sat on the card it was lifted from, in millimetres. */
  frame: Frame;
}

export interface SuiteTemplate {
  slug: string;
  document: DesignDocumentInput;
  /** The product the finished design is ordered as: jolene.ro's own slug. */
  shopifyProductHandle?: string;
}

/** One of Jolene's collections, as each deployment's seed stores it. */
export interface Suite {
  slug: string;
  name: Labels;
  description: Labels;
  occasion: Occasion;
  /** Words to browse by, from suiteStyles in @jolene/design. */
  styles: string[];
  /** The details the gallery previews the collection with. */
  sampleFields: Fields;
  art: Record<string, Artwork>;
  templates: SuiteTemplate[];
}

type ImageLayerInput = Extract<LayerInput, { type: "image" }>;

/**
 * An artwork layer, locked, where the artwork sat on its own card unless the
 * template moves it. `scale` grows or shrinks it about its top-left corner.
 */
export function artLayer(
  id: string,
  key: string,
  art: Record<string, Artwork>,
  place: Partial<Frame> & { scale?: number } = {},
  options: Partial<ImageLayerInput> = {},
): ImageLayerInput {
  const artwork = art[key];
  if (!artwork) throw new Error(`No artwork "${key}"`);
  const { scale = 1, ...frame } = place;
  return {
    id,
    name: artwork.name,
    type: "image",
    asset: key,
    fit: "contain",
    locked: true,
    frame: {
      x: artwork.frame.x,
      y: artwork.frame.y,
      width: artwork.frame.width * scale,
      height: artwork.frame.height * scale,
      ...frame,
    },
    ...options,
  };
}
