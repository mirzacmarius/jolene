import { authTables } from "@convex-dev/auth/server";
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import {
  aiChangeValidator,
  aiErrorValidator,
  aiRoleValidator,
  aiStatusValidator,
  aiUsageValidator,
} from "./ai/validators";
import { toneValidator } from "./simple/tones";
import {
  authorValidator,
  documentValidator,
  fieldsValidator,
  labelsValidator,
  languageValidator,
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
    /** An uploaded file, such as a couple's photo. */
    storageId: v.optional(v.id("_storage")),
    /**
     * A file the studio serves itself, by its path from the studio's root:
     * Jolene's artwork ships with the studio's code. An asset has a path or a
     * storageId.
     */
    path: v.optional(v.string()),
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
    /**
     * Set once its suite no longer lists it: the catalog stops showing it and
     * no new design starts from it, while designs started from it keep it.
     */
    retired: v.optional(v.literal(true)),
  })
    .index("by_slug", ["slug"])
    .index("by_suiteId_and_retired_and_sortOrder", [
      "suiteId",
      "retired",
      "sortOrder",
    ]),

  /**
   * A couple's wedding (or a family's christening): the details every one of
   * their designs reads, typed once.
   */
  events: defineTable({
    ownerId: v.id("users"),
    occasion: occasionValidator,
    fields: fieldsValidator,
    /**
     * How the couple wants their collection's wording, from simple mode's
     * questions: its tone, a line of their own and the cards' language. The
     * AI designer reads it with every message, so later items follow it.
     */
    wording: v.optional(
      v.object({
        tone: v.optional(toneValidator),
        line: v.optional(v.string()),
        language: languageValidator,
      }),
    ),
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

  /**
   * Each design's conversation with the AI designer as the studio shows it:
   * the couple's words, the replies and the changes each reply made. What
   * the Messages API reads back is kept in aiTurns.
   */
  aiMessages: defineTable({
    designId: v.id("designs"),
    ownerId: v.id("users"),
    role: aiRoleValidator,
    /** The couple's words, or the reply as far as it is written. */
    text: v.string(),
    status: aiStatusValidator,
    /** The conversation with the API the message belongs to (see aiTurns). */
    thread: v.number(),
    /** The studio's language when the couple wrote, which the reply is in. */
    locale: v.optional(languageValidator),
    /** The rendering of the design the couple's words came with. */
    snapshot: v.optional(v.id("_storage")),
    /** Short notes on what the AI designer is doing, written as it works. */
    notes: v.optional(v.array(v.string())),
    changes: v.optional(v.array(aiChangeValidator)),
    error: v.optional(aiErrorValidator),
    usage: v.optional(aiUsageValidator),
    /** The model that answered when a server-side fallback stood in. */
    servedBy: v.optional(v.string()),
    /** The composition a reply writes an item of, for simple mode. */
    composition: v.optional(v.id("compositions")),
    /** Requests the reply has made; a reply makes at most a few. */
    rounds: v.optional(v.number()),
    /** Input tokens of the reply's latest request: how long the thread is. */
    contextTokens: v.optional(v.number()),
    /** The design's revision and the details, as the AI designer knows them. */
    seen: v.optional(v.object({ revision: v.number(), details: v.string() })),
    /**
     * The rendering the reply waits for: the tool call that asked, and the
     * revision the studio should show.
     */
    rendering: v.optional(
      v.object({ toolUseId: v.string(), revision: v.number() }),
    ),
    /** The round's other tool results while the rendering is awaited, JSON. */
    pendingResults: v.optional(v.string()),
    /**
     * The thread can't go on (a refusal, a context too long, a request the
     * API turns away): the next message starts a new one.
     */
    endsThread: v.optional(v.boolean()),
    /**
     * The reply ended before the API answered any of it (it failed at once,
     * or was stopped before it began), so its message doesn't count toward
     * the day's limits. Running it again counts it again.
     */
    refunded: v.optional(v.literal(true)),
    /**
     * What the thread's requests are made with (model, system prompt and
     * tools), hashed: when a deploy changes it, the next message starts a
     * new thread.
     */
    prompt: v.optional(v.string()),
    finishedAt: v.optional(v.number()),
    updatedAt: v.number(),
  })
    .index("by_designId", ["designId"])
    .index("by_ownerId_and_role_and_refunded", ["ownerId", "role", "refunded"])
    .index("by_role_and_refunded", ["role", "refunded"]),

  /**
   * The AI designer's conversations as the Messages API reads them: one row
   * per API message, sent back verbatim and in order with every later request
   * of the same thread, thinking included. Kept apart from aiMessages because
   * a reply's rounds can outgrow one document.
   */
  aiTurns: defineTable({
    designId: v.id("designs"),
    thread: v.number(),
    messageId: v.id("aiMessages"),
    role: v.union(v.literal("user"), v.literal("assistant")),
    /** The content blocks as JSON; images refer to stored files. */
    content: v.string(),
  }).index("by_designId_and_thread", ["designId", "thread"]),

  /**
   * Simple mode's AI flow over one event's collection: the AI designer writes
   * the wording of each item the couple chose and lays it out, each in its
   * design's own conversation. The first item (the invitation, when chosen)
   * is written first; the others then begin with its wording to follow.
   */
  compositions: defineTable({
    ownerId: v.id("users"),
    eventId: v.id("events"),
    suiteId: v.id("suites"),
    /**
     * The items the AI designer writes, first item first, each with the
     * reply writing it. Items the day's messages didn't cover aren't here.
     */
    items: v.array(
      v.object({ designId: v.id("designs"), replyId: v.id("aiMessages") }),
    ),
    updatedAt: v.number(),
  }).index("by_eventId_and_suiteId", ["eventId", "suiteId"]),
});
