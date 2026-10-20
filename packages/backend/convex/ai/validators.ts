import { v } from "convex/values";

/** Who speaks in a design's conversation with the AI designer. */
export const aiRoleValidator = v.union(
  v.literal("couple"),
  v.literal("designer"),
);

/**
 * Where a reply stands. "waiting" waits for another reply first (a later
 * item of a composition waits for the first item's), "pending" waits for
 * its first request to start, "streaming" is being written or is changing
 * the design, and "rendering" waits for the open studio to show it the
 * design (look_at_design).
 */
export const aiStatusValidator = v.union(
  v.literal("waiting"),
  v.literal("pending"),
  v.literal("streaming"),
  v.literal("rendering"),
  v.literal("done"),
  v.literal("failed"),
  v.literal("stopped"),
);

/**
 * Why a reply failed, for the studio to word in the visitor's language:
 * "refused" when the model declined the request, "busy" when the API is
 * overloaded or rate limited (try again soon), "unavailable" when the
 * deployment's key or model is wrong, "failed" for anything else.
 */
export const aiErrorValidator = v.union(
  v.literal("refused"),
  v.literal("busy"),
  v.literal("unavailable"),
  v.literal("failed"),
);

/**
 * A change a reply made, which the couple can undo: a version of the design,
 * or some of the couple's details, with what they were before.
 */
export const aiChangeValidator = v.union(
  v.object({
    kind: v.literal("design"),
    /** The design's revision the change made. */
    revision: v.number(),
    note: v.string(),
    /** When the couple undid it. */
    undoneAt: v.optional(v.number()),
  }),
  v.object({
    kind: v.literal("details"),
    /** The values the change replaced; "" for a detail that was empty. */
    previous: v.record(v.string(), v.string()),
    note: v.string(),
    undoneAt: v.optional(v.number()),
  }),
);

/** Tokens a reply used, summed over its requests, to watch what it costs. */
export const aiUsageValidator = v.object({
  input: v.number(),
  output: v.number(),
  cacheRead: v.number(),
  cacheWrite: v.number(),
});
