import { v } from "convex/values";

/** How a couple answers an order option: picking a choice, or writing. */
export const lineOptionKindValidator = v.union(
  v.literal("select"),
  v.literal("text"),
  v.literal("textarea"),
  v.literal("email"),
);

/** One of a select's choices, and what it adds to each one ordered, in bani. */
export const choiceValidator = v.object({
  label: v.string(),
  price: v.number(),
});

/**
 * What a product is made of, such as its paper: the couple picks one of its
 * values, and each value adds its surcharge to each one ordered, in bani.
 */
export const productOptionValidator = v.object({
  name: v.string(),
  values: v.array(v.object({ name: v.string(), surcharge: v.number() })),
});

/**
 * A product's photo: the address it came from, and its copy in storage once
 * it has one, which the shop shows instead.
 */
export const productImageValidator = v.object({
  source: v.string(),
  alt: v.string(),
  storageId: v.optional(v.id("_storage")),
});
