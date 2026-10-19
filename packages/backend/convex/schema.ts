import { authTables } from "@convex-dev/auth/server";
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import {
  authorValidator,
  documentValidator,
  fieldsValidator,
  labelsValidator,
  occasionValidator,
  productKindValidator,
} from "./utils/validators";

export default defineSchema({
  ...authTables,

  users: defineTable({
    name: v.optional(v.string()),
    image: v.optional(v.string()),
    email: v.optional(v.string()),
    emailVerificationTime: v.optional(v.number()),
    phone: v.optional(v.string()),
    phoneVerificationTime: v.optional(v.number()),
    isAnonymous: v.optional(v.boolean()),
  }).index("email", ["email"]),

  /**
   * Files designs draw: Jolene's artwork, paper textures, couples' photos.
   * Documents refer to an asset by its key, which stays the same from one
   * deployment to the next, so templates move between them unchanged.
   */
  assets: defineTable({
    key: v.string(),
    storageId: v.id("_storage"),
    kind: v.union(
      v.literal("artwork"),
      v.literal("photo"),
      v.literal("texture"),
    ),
    contentType: v.string(),
    /** Single-colour line art that a layer's tint can repaint. */
    recolorable: v.boolean(),
    name: v.optional(v.string()),
    /** Set on photos: only their owner's designs may use them. */
    ownerId: v.optional(v.id("users")),
  }).index("by_key", ["key"]),

  /** A family of designs sharing artwork, palette and type: a collection. */
  suites: defineTable({
    slug: v.string(),
    name: labelsValidator,
    description: labelsValidator,
    occasion: occasionValidator,
    /** Style words for browsing, such as "botanic" or "vellum". */
    styles: v.array(v.string()),
    published: v.boolean(),
    sortOrder: v.number(),
    /** Example details the gallery previews the suite with. */
    sampleFields: fieldsValidator,
  })
    .index("by_slug", ["slug"])
    .index("by_published_and_sortOrder", ["published", "sortOrder"]),

  /** One item of a suite, ready to personalise. */
  templates: defineTable({
    suiteId: v.id("suites"),
    slug: v.string(),
    kind: productKindValidator,
    document: documentValidator,
    /** The Shopify product a finished design is ordered as. */
    shopifyProductHandle: v.optional(v.string()),
    sortOrder: v.number(),
  })
    .index("by_slug", ["slug"])
    .index("by_suiteId_and_sortOrder", ["suiteId", "sortOrder"]),

  /**
   * A couple's wedding (or a family's christening): the details every one of
   * their designs reads, typed once.
   */
  events: defineTable({
    ownerId: v.id("users"),
    occasion: occasionValidator,
    fields: fieldsValidator,
    updatedAt: v.number(),
  }).index("by_ownerId_and_occasion", ["ownerId", "occasion"]),

  /** One personalised item, started from a template. */
  designs: defineTable({
    ownerId: v.id("users"),
    eventId: v.id("events"),
    templateId: v.id("templates"),
    kind: productKindValidator,
    document: documentValidator,
    /** Goes up by one with every change, so edits can't overwrite each other. */
    revision: v.number(),
    updatedAt: v.number(),
  })
    .index("by_ownerId_and_updatedAt", ["ownerId", "updatedAt"])
    .index("by_eventId", ["eventId"]),

  /**
   * Saved versions of a design, to go back to. A person's edits a few minutes
   * apart fold into one version; the template they started from, every AI
   * change and every restore is a version of its own.
   */
  designVersions: defineTable({
    designId: v.id("designs"),
    /** The design's revision this version holds. */
    revision: v.number(),
    document: documentValidator,
    author: authorValidator,
    /** What changed, in the words of whoever changed it. */
    note: v.optional(v.string()),
    /** The revision this version brought back, when it is a restore. */
    restoredFrom: v.optional(v.number()),
    updatedAt: v.number(),
  }).index("by_designId_and_revision", ["designId", "revision"]),
});
