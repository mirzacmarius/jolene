import { languages, occasions, productKinds } from "@jolene/design";
import { v } from "convex/values";

const literals = <T extends string>(values: readonly T[]) =>
  v.union(...values.map((value) => v.literal(value)));

export const occasionValidator = literals(occasions);
export const productKindValidator = literals(productKinds);
export const languageValidator = literals(languages);

/** Text in every language the studio speaks. */
export const labelsValidator = v.object({ ro: v.string(), en: v.string() });

/**
 * A design document. Its shape is checked by @jolene/design's schema in the
 * functions that write it; Convex stores it as given.
 */
export const documentValidator = v.any();

/** A couple's details by field key, as fields.ts in @jolene/design lists them. */
export const fieldsValidator = v.record(v.string(), v.string());

/**
 * Who made a version of a design: the template it started from, the couple,
 * or the AI co-designer at their request.
 */
export const authorValidator = v.union(
  v.literal("template"),
  v.literal("person"),
  v.literal("ai"),
);
