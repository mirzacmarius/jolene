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
import {
  channelValidator,
  emailStatusValidator,
  questionsValidator,
  replyValidator,
  sideValidator,
  unlockValidator,
} from "./invites/validators";
import { orderStatusValidator } from "./orders/status";
import {
  addressValidator,
  billingValidator,
  customerValidator,
  deliveryValidator,
  orderFeeValidator,
  orderLineValidator,
} from "./orders/validators";
import {
  answerValidator,
  choiceValidator,
  lineOptionKindValidator,
  pickedValidator,
  productImageValidator,
  productOptionValidator,
} from "./shop/validators";
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
  })
    .index("by_key", ["key"])
    .index("by_ownerId", ["ownerId"]),

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
    /** The shop's product a finished design is ordered as, named when Shopify sold it. */
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
     * The latest drawing of the design its thread has shown the model, a
     * snapshot or a rendering: the revision, the view and the details drawn.
     * A message that would show the same again goes without its snapshot.
     */
    looked: v.optional(
      v.object({ revision: v.number(), view: v.string(), details: v.string() }),
    ),
    /**
     * The rendering the reply waits for: the tool call that asked, and the
     * revision the studio should show.
     */
    rendering: v.optional(
      v.object({
        toolUseId: v.string(),
        revision: v.number(),
        /** The view asked for, when not the one the couple is looking at. */
        view: v.optional(v.string()),
      }),
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
  })
    .index("by_eventId_and_suiteId", ["eventId", "suiteId"])
    .index("by_ownerId", ["ownerId"]),

  /**
   * A design as its couple approved it for print (a proof): the document and
   * their details as they were, which the workshop prints from. Later changes
   * to the design or the details make a new proof, never change this one.
   */
  proofs: defineTable({
    designId: v.id("designs"),
    ownerId: v.id("users"),
    templateId: v.id("templates"),
    kind: productKindValidator,
    /** The design's revision the couple approved. */
    revision: v.number(),
    document: documentValidator,
    /** The event's details, all of them: the monogram reads the names. */
    fields: fieldsValidator,
    /** The studio's picture of the proof, shown with the order. */
    image: v.optional(v.id("_storage")),
    approvedAt: v.number(),
  })
    .index("by_designId", ["designId"])
    .index("by_ownerId", ["ownerId"]),

  /**
   * A product the shop sells, under the name it had on jolene.ro (ADR 0015).
   * Its prices, like every price the shop keeps, are in bani.
   */
  products: defineTable({
    handle: v.string(),
    title: v.string(),
    descriptionHtml: v.string(),
    /** Each one, before its paper's surcharge and its paid choices. */
    price: v.number(),
    /** The price before a sale, while the product is on sale. */
    compareAtPrice: v.optional(v.number()),
    /** What it's made of, such as its paper. */
    options: v.array(productOptionValidator),
    /** The handles of the order options its line asks, in order. */
    lineOptions: v.array(v.string()),
    /** The handles of its categories, their parents included. */
    categories: v.array(v.string()),
    tags: v.array(v.string()),
    images: v.array(productImageValidator),
    /** The smallest quantity Jolene takes an order for. */
    minQuantity: v.optional(v.number()),
    /** The keys of the fees an order of it can carry, such as diacritics. */
    fees: v.array(v.string()),
    /** Its place in the shop's lists, where jolene.ro had it. */
    position: v.number(),
    /** On sale: the shop shows it and sells it. */
    published: v.boolean(),
    /**
     * Bought for one of a couple's events, as the digital invitation is: its
     * cart line carries the event, one line each, and nothing of it is
     * delivered. The studio sends the couple to its page, so the shop's
     * lists, search and sitemap leave it out.
     */
    forEvent: v.optional(v.literal(true)),
    /**
     * When Jolene's team last changed it: from then on the seed leaves it
     * as they made it.
     */
    editedAt: v.optional(v.number()),
    /** The workshop account that last changed it. */
    editedBy: v.optional(v.string()),
  })
    .index("by_handle", ["handle"])
    .index("by_published_and_forEvent_and_position", [
      "published",
      "forEvent",
      "position",
    ])
    .index("by_published_and_forEvent_and_price", [
      "published",
      "forEvent",
      "price",
    ])
    .searchIndex("search_title", {
      searchField: "title",
      filterFields: ["published", "forEvent"],
    }),

  /**
   * A product's place on one of its categories' shelves, so a category lists
   * its products in order without reading the others.
   */
  productCategories: defineTable({
    category: v.string(),
    productId: v.id("products"),
    /** The product's own, kept in step with it by `shelve`. */
    published: v.boolean(),
    position: v.number(),
    price: v.number(),
  })
    .index("by_category_and_published_and_position", [
      "category",
      "published",
      "position",
    ])
    .index("by_category_and_published_and_price", [
      "category",
      "published",
      "price",
    ])
    .index("by_productId", ["productId"]),

  /** A shelf of the shop, one of jolene.ro's categories. */
  categories: defineTable({
    handle: v.string(),
    title: v.string(),
    position: v.number(),
    editedAt: v.optional(v.number()),
  })
    .index("by_handle", ["handle"])
    .index("by_position", ["position"]),

  /**
   * What a couple chooses or writes with a line, apart from its paper (ADR
   * 0008), shared by the products that ask the same.
   */
  lineOptions: defineTable({
    handle: v.string(),
    /** What it asks, the same wherever it's asked: the shop fills it in from a design by it. */
    key: v.string(),
    label: v.string(),
    hint: v.optional(v.string()),
    kind: lineOptionKindValidator,
    required: v.boolean(),
    /** A select's choices, in order. */
    choices: v.array(choiceValidator),
    editedAt: v.optional(v.number()),
  }).index("by_handle", ["handle"]),

  /**
   * A visitor's cart in the shop. The shop's server keeps its token in a
   * cookie and finds the cart by it; the token is its only key.
   */
  carts: defineTable({
    token: v.string(),
    updatedAt: v.number(),
  }).index("by_token", ["token"]),

  /** A product in a cart, with what the couple chose for it. */
  cartLines: defineTable({
    cartId: v.id("carts"),
    productId: v.id("products"),
    quantity: v.number(),
    /** A value for each of the product's options, such as its paper. */
    options: v.array(pickedValidator),
    /** The order options' answers, by the option's key. */
    answers: v.array(answerValidator),
    /** The keys of the fees the couple chose with it: the order pays each once. */
    fees: v.array(v.string()),
    /** The design the couple approved for it in the studio. */
    proofId: v.optional(v.id("proofs")),
    /** The event a product `forEvent` is bought for. */
    eventId: v.optional(v.id("events")),
  }).index("by_cartId", ["cartId"]),

  /** A one-off charge on an order, such as for diacritics or an urgent order. */
  fees: defineTable({
    key: v.string(),
    label: v.string(),
    /** A line under the label: what the fee pays for. */
    description: v.optional(v.string()),
    price: v.number(),
    editedAt: v.optional(v.number()),
  }).index("by_key", ["key"]),

  /**
   * A cart as it went to Stripe's checkout, priced from the catalog then:
   * what the couple pays for, and what their order keeps once they have.
   */
  checkouts: defineTable({
    cartId: v.id("carts"),
    /** Its cart lines, taken out of the cart once it's paid. */
    cartLines: v.array(v.id("cartLines")),
    lines: v.array(orderLineValidator),
    fees: v.array(orderFeeValidator),
    /** The lines and the fees together, in bani, before delivery and discounts. */
    subtotal: v.number(),
    language: languageValidator,
    /**
     * When the couple agreed to unlock right away the digital invitation it
     * charges for, which ends their 14 days to withdraw from it.
     */
    unlockNowAt: v.optional(v.number()),
  }),

  /**
   * What a couple paid for in one checkout: its lines and fees as priced
   * when they went to pay, how it travels and where to.
   */
  orders: defineTable({
    /** What the couple and the workshop call it: J and this, as J1001. */
    number: v.number(),
    /** The order page's key, in the link the couple's emails carry. */
    token: v.string(),
    /** The Stripe Checkout Session it was paid through: one order each. */
    session: v.string(),
    paymentIntent: v.optional(v.string()),
    /** Paid in Stripe's test mode: a trial, not a sale. */
    test: v.boolean(),
    language: languageValidator,
    lines: v.array(orderLineValidator),
    fees: v.array(orderFeeValidator),
    /** The lines and the fees together, in bani. */
    subtotal: v.number(),
    /** None when nothing in it travels. */
    delivery: v.optional(deliveryValidator),
    /** What a promotion code took off, in bani. */
    discount: v.number(),
    /** What Stripe charged, in bani. */
    total: v.number(),
    /**
     * The VAT in the total, in bani, as Stripe Tax worked it out: prices
     * include it. None when Stripe Tax was off, and 0 when it found no VAT
     * to charge, as without a registration where the order goes.
     */
    vat: v.optional(v.number()),
    customer: customerValidator,
    address: v.optional(addressValidator),
    /** When the couple agreed, before paying, to unlock its digital invitation right away. */
    unlockNowAt: v.optional(v.number()),
    /** Who the invoice is for. None on orders from before Stripe asked. */
    billing: v.optional(billingValidator),
    paidAt: v.number(),
    /**
     * Where it is between paid and in the couple's hands. Orders paid before
     * statuses get theirs from the seed (workshop/statuses.ts).
     */
    status: v.optional(orderStatusValidator),
  })
    .index("by_number", ["number"])
    .index("by_token", ["token"])
    .index("by_session", ["session"])
    .index("by_status_and_number", ["status", "number"]),

  /**
   * What happened to an order since it was paid, oldest first: each change
   * of its status and each note the workshop wrote on it, with who did it.
   */
  orderHistory: defineTable(
    v.union(
      v.object({
        orderId: v.id("orders"),
        /** The workshop account's email. */
        by: v.string(),
        kind: v.literal("status"),
        from: orderStatusValidator,
        status: orderStatusValidator,
      }),
      v.object({
        orderId: v.id("orders"),
        by: v.string(),
        kind: v.literal("note"),
        note: v.string(),
      }),
    ),
  ).index("by_orderId", ["orderId"]),

  /**
   * Who manages an event with its owner: a partner who joined by the
   * couple's link sees and changes its digital invitation.
   */
  eventPartners: defineTable({
    eventId: v.id("events"),
    userId: v.id("users"),
    joinedAt: v.number(),
  })
    .index("by_eventId", ["eventId"])
    .index("by_userId_and_eventId", ["userId", "eventId"]),

  /**
   * An event's digital invitation: the page guests open on their phone, with
   * the couple's invitation design, the day's programme and the reply form.
   */
  invites: defineTable({
    eventId: v.id("events"),
    /** Its address: INVITE_URL/<slug>. */
    slug: v.string(),
    /** The language its page speaks: the invitation design's, at first. */
    language: languageValidator,
    /**
     * The invitation design as guests see it: a copy made when the couple
     * publishes, so their later changes show once they publish again.
     * Guests see nothing before the first.
     */
    published: v.optional(
      v.object({
        designId: v.id("designs"),
        revision: v.number(),
        document: documentValidator,
        /** The studio's picture of it, for link previews and emails. */
        image: v.optional(v.id("_storage")),
        at: v.number(),
      }),
    ),
    /** Anyone with the invitation's own address can reply, adding their family. */
    open: v.boolean(),
    questions: questionsValidator,
    /** The couple's words under the invitation, such as where to park. */
    note: v.optional(v.string()),
    /** Set once it's paid for, free with printed invitations, or opened by hand. */
    unlocked: v.optional(unlockValidator),
    /** The code of the link a partner joins the event by, while there's one. */
    partnerCode: v.optional(v.string()),
    updatedAt: v.number(),
  })
    .index("by_eventId", ["eventId"])
    .index("by_slug", ["slug"])
    .index("by_partnerCode", ["partnerCode"]),

  /**
   * The people one invitation goes to, such as a couple, a family with
   * children or one friend: they open it by their own link and reply
   * together.
   */
  households: defineTable({
    inviteId: v.id("invites"),
    /** How the invitation addresses them, as on an envelope. */
    name: v.string(),
    /** Their link's code: INVITE_URL/<slug>/<code>. */
    code: v.string(),
    /** How many of them are invited, children included. */
    seats: v.number(),
    /** They may bring someone of their own. */
    plusOne: v.boolean(),
    side: v.optional(sideValidator),
    phone: v.optional(v.string()),
    email: v.optional(v.string()),
    /** The language their page opens in, when not the invitation's. */
    language: v.optional(languageValidator),
    /** The couple added them, or they added themselves by the open link. */
    source: v.union(v.literal("couple"), v.literal("open")),
    /** The couple's own note about them, which guests never see. */
    note: v.optional(v.string()),
    /** When the couple last sent them their link, and how. */
    sent: v.optional(v.object({ by: channelValidator, at: v.number() })),
    /** Where the latest email of their invitation has got to. */
    emailed: v.optional(
      v.object({ status: emailStatusValidator, at: v.number() }),
    ),
    /** When they first opened their invitation. */
    openedAt: v.optional(v.number()),
    /** Their latest reply; every one is also in replies. */
    reply: v.optional(replyValidator),
    updatedAt: v.number(),
  })
    .index("by_inviteId", ["inviteId"])
    .index("by_inviteId_and_code", ["inviteId", "code"]),

  /** Every reply a family sent or the couple took, for the couple's history. */
  replies: defineTable({
    inviteId: v.id("invites"),
    householdId: v.id("households"),
    reply: replyValidator,
  })
    .index("by_inviteId", ["inviteId"])
    .index("by_householdId", ["householdId"]),

  /** The emails of digital invitations, to tell the couple which bounced. */
  inviteEmails: defineTable({
    inviteId: v.id("invites"),
    householdId: v.id("households"),
    /** The Resend component's id for it. */
    emailId: v.string(),
    to: v.string(),
    status: emailStatusValidator,
    updatedAt: v.number(),
  })
    .index("by_emailId", ["emailId"])
    .index("by_householdId", ["householdId"]),
});
