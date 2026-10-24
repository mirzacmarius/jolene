import { assetKeys, type DesignDocument, type languages } from "@jolene/design";
import { ConvexError, v } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import {
  action,
  type MutationCtx,
  mutation,
  type QueryCtx,
  query,
} from "./_generated/server";
import { emailLayout, fromHeader, sendEmail, sender } from "./emails";
import {
  type EventRole,
  eventRole,
  inviteOf,
  requireEvent,
  requireInvite,
  viewerAccount,
} from "./invites/access";
import {
  householdLink,
  inviteBaseUrl,
  isSlug,
  partnerCode,
  suggestedSlug,
} from "./invites/codes";
import {
  cleanQuestions,
  defaultMeals,
  householdsOf,
  LENGTHS,
  TRIAL_HOUSEHOLDS,
  trialHouseholds,
} from "./invites/rules";
import { eventForShop, eventForShopValidator } from "./invites/shop";
import { hosts, invitationEmail } from "./invites/text";
import {
  questionsValidator,
  replyValidator,
  unlockValidator,
} from "./invites/validators";
import schema from "./schema";
import { resolveAssets, resolvedAssetValidator } from "./utils/assets";
import { errors } from "./utils/errors";
import { imageType } from "./utils/images";
import { rateLimiter } from "./utils/limits";
import {
  documentValidator,
  fieldsValidator,
  labelsValidator,
  languageValidator,
  occasionValidator,
} from "./utils/validators";

/**
 * A couple's digital invitation, as they manage it: which design guests
 * see, its address, what the reply form asks, who it goes to, and the
 * replies. The guests' side is in guests.ts.
 */

/** The largest picture of an invitation kept, well above what the studio sends. */
const MAX_IMAGE_BYTES = 4 * 1024 * 1024;

/** One of an event's invitation designs, for the couple to publish. */
async function invitationDesign(
  ctx: QueryCtx,
  event: Doc<"events">,
  designId: Id<"designs">,
) {
  const design = await ctx.db.get("designs", designId);
  if (!design || design.eventId !== event._id || design.kind !== "invitation")
    throw new ConvexError(errors.notFound);
  return design;
}

/**
 * The address an invitation starts with: the one its names suggest, or
 * with a number after it when another invitation has it.
 */
async function freeSlug(ctx: QueryCtx, event: Doc<"events">) {
  const base = suggestedSlug(event.occasion, event.fields);
  for (let n = 1; n < 50; n++) {
    const slug = n === 1 ? base : `${base}-${n}`;
    const taken = await ctx.db
      .query("invites")
      .withIndex("by_slug", (q) => q.eq("slug", slug))
      .first();
    if (!taken) return slug;
  }
  return `${base}-${Date.now().toString(36)}`;
}

/**
 * The event's digital invitation, made the first time it's needed: when
 * the couple starts it, or an order unlocks it before they have.
 */
export async function ensureInvite(
  ctx: MutationCtx,
  event: Doc<"events">,
  language: (typeof languages)[number],
) {
  const existing = await inviteOf(ctx, event._id);
  if (existing) return existing;
  const inviteId = await ctx.db.insert("invites", {
    eventId: event._id,
    slug: await freeSlug(ctx, event),
    language,
    open: true,
    questions: { meals: defaultMeals(language), allergies: true },
    updatedAt: Date.now(),
  });
  return (await ctx.db.get("invites", inviteId)) as Doc<"invites">;
}

const publishedValidator = v.object({
  designId: v.id("designs"),
  revision: v.number(),
  at: v.number(),
  image: v.union(v.string(), v.null()),
});

const inviteValidator = v.object({
  _id: v.id("invites"),
  slug: v.string(),
  language: languageValidator,
  open: v.boolean(),
  questions: questionsValidator,
  note: v.optional(v.string()),
  unlocked: v.optional(unlockValidator),
  partnerCode: v.optional(v.string()),
  published: v.union(publishedValidator, v.null()),
});

/** An invitation as the couple's page shows it, without the document. */
async function inviteSummary(ctx: QueryCtx, invite: Doc<"invites">) {
  const { published } = invite;
  return {
    _id: invite._id,
    slug: invite.slug,
    language: invite.language,
    open: invite.open,
    questions: invite.questions,
    note: invite.note,
    unlocked: invite.unlocked,
    partnerCode: invite.partnerCode,
    published: published
      ? {
          designId: published.designId,
          revision: published.revision,
          at: published.at,
          image: published.image
            ? await ctx.storage.getUrl(published.image)
            : null,
        }
      : null,
  };
}

/** Who manages the event: its owner first, then partners. */
async function managers(ctx: QueryCtx, event: Doc<"events">) {
  const owner = await ctx.db.get("users", event.ownerId);
  const partners = await ctx.db
    .query("eventPartners")
    .withIndex("by_eventId", (q) => q.eq("eventId", event._id))
    .take(10);
  const people: {
    userId: Id<"users">;
    email: string | null;
    role: EventRole;
  }[] = [{ userId: event.ownerId, email: owner?.email ?? null, role: "owner" }];
  for (const partner of partners) {
    const user = await ctx.db.get("users", partner.userId);
    people.push({
      userId: partner.userId,
      email: user?.email ?? null,
      role: "partner",
    });
  }
  return people;
}

const roleValidator = v.union(v.literal("owner"), v.literal("partner"));

/**
 * Everything the couple's page shows of an event's digital invitation: its
 * settings, the guest list with the replies, the invitation designs it can
 * show, and who manages it. Asks a visitor without an account to sign in.
 */
export const dashboard = query({
  args: { eventId: v.string() },
  returns: v.union(
    v.object({ kind: v.literal("account-needed") }),
    v.object({ kind: v.literal("not-found") }),
    v.object({
      kind: v.literal("ready"),
      role: roleValidator,
      /** Who the invitation is from, in each language. */
      hosts: labelsValidator,
      event: v.object({
        _id: v.id("events"),
        occasion: occasionValidator,
        fields: v.record(v.string(), v.string()),
      }),
      designs: v.array(
        v.object({
          _id: v.id("designs"),
          revision: v.number(),
          updatedAt: v.number(),
          suite: v.union(labelsValidator, v.null()),
        }),
      ),
      invite: v.union(inviteValidator, v.null()),
      households: v.array(schema.doc("households")),
      people: v.array(
        v.object({
          userId: v.id("users"),
          email: v.union(v.string(), v.null()),
          role: roleValidator,
        }),
      ),
      /** Where guests open invitations; null until SITE_URL is set. */
      base: v.union(v.string(), v.null()),
      /** Families who can open it before it's paid for. */
      trial: v.number(),
    }),
  ),
  handler: async (ctx, args) => {
    const user = await viewerAccount(ctx);
    if (!user) return { kind: "account-needed" as const };
    const eventId = ctx.db.normalizeId("events", args.eventId);
    const event = eventId && (await ctx.db.get("events", eventId));
    const role = event && (await eventRole(ctx, event, user._id));
    if (!event || !role) return { kind: "not-found" as const };
    const designs = (
      await ctx.db
        .query("designs")
        .withIndex("by_eventId", (q) => q.eq("eventId", event._id))
        .take(100)
    ).filter((design) => design.kind === "invitation");
    const invite = await inviteOf(ctx, event._id);
    return {
      kind: "ready" as const,
      role,
      hosts: hosts(event),
      event: { _id: event._id, occasion: event.occasion, fields: event.fields },
      designs: await Promise.all(
        designs.map(async (design) => {
          const template = await ctx.db.get("templates", design.templateId);
          const suite =
            template && (await ctx.db.get("suites", template.suiteId));
          return {
            _id: design._id,
            revision: design.revision,
            updatedAt: design.updatedAt,
            suite: suite?.name ?? null,
          };
        }),
      ),
      invite: invite ? await inviteSummary(ctx, invite) : null,
      households: invite ? await householdsOf(ctx, invite) : [],
      people: await managers(ctx, event),
      base: inviteBaseUrl(),
      trial: TRIAL_HOUSEHOLDS,
    };
  },
});

/**
 * How big the event's guest list is, for the studio to say beside how many
 * invitations the couple orders: its families and the people in them. Null
 * without a guest list, or for anyone who doesn't manage the event.
 */
export const listSize = query({
  args: { eventId: v.id("events") },
  returns: v.union(
    v.object({ households: v.number(), seats: v.number() }),
    v.null(),
  ),
  handler: async (ctx, { eventId }) => {
    const user = await viewerAccount(ctx);
    const event = await ctx.db.get("events", eventId);
    if (!user || !event || !(await eventRole(ctx, event, user._id)))
      return null;
    const invite = await inviteOf(ctx, event._id);
    const households = invite ? await householdsOf(ctx, invite) : [];
    if (households.length === 0) return null;
    return {
      households: households.length,
      seats: households.reduce((sum, household) => sum + household.seats, 0),
    };
  },
});

/**
 * The event's invitation designs as the couple's page draws them, and the
 * version guests see. A partner sees them here, though the designs
 * themselves open only for the event's owner.
 */
export const previews = query({
  args: { eventId: v.id("events") },
  returns: v.union(
    v.object({
      fields: fieldsValidator,
      designs: v.array(
        v.object({
          _id: v.id("designs"),
          revision: v.number(),
          document: documentValidator,
        }),
      ),
      published: v.union(
        v.object({
          designId: v.id("designs"),
          revision: v.number(),
          document: documentValidator,
        }),
        v.null(),
      ),
      assets: v.array(resolvedAssetValidator),
    }),
    v.null(),
  ),
  handler: async (ctx, { eventId }) => {
    const user = await viewerAccount(ctx);
    const event = await ctx.db.get("events", eventId);
    if (!user || !event || !(await eventRole(ctx, event, user._id)))
      return null;
    const designs = (
      await ctx.db
        .query("designs")
        .withIndex("by_eventId", (q) => q.eq("eventId", event._id))
        .take(100)
    ).filter((design) => design.kind === "invitation");
    const published = (await inviteOf(ctx, event._id))?.published;
    const documents = [
      ...designs.map((design) => design.document as DesignDocument),
      ...(published ? [published.document as DesignDocument] : []),
    ];
    return {
      fields: event.fields,
      designs: designs.map((design) => ({
        _id: design._id,
        revision: design.revision,
        document: design.document,
      })),
      published: published
        ? {
            designId: published.designId,
            revision: published.revision,
            document: published.document,
          }
        : null,
      // A couple's photo resolves for them, the event's owner.
      assets: await resolveAssets(
        ctx,
        documents.flatMap(assetKeys),
        event.ownerId,
      ),
    };
  },
});

/**
 * The events the signed-in account manages, with their digital invitation
 * if they have one, for the studio's list of designs.
 */
export const mine = query({
  args: {},
  returns: v.array(
    v.object({
      eventId: v.id("events"),
      occasion: occasionValidator,
      hosts: labelsValidator,
      role: roleValidator,
      invite: v.union(
        v.object({
          slug: v.string(),
          published: v.boolean(),
          unlocked: v.boolean(),
        }),
        v.null(),
      ),
    }),
  ),
  handler: async (ctx) => {
    const user = await viewerAccount(ctx);
    if (!user) return [];
    const owned = await ctx.db
      .query("events")
      .withIndex("by_ownerId_and_occasion", (q) => q.eq("ownerId", user._id))
      .take(20);
    const joined = await ctx.db
      .query("eventPartners")
      .withIndex("by_userId_and_eventId", (q) => q.eq("userId", user._id))
      .take(20);
    const events: { event: Doc<"events">; role: EventRole }[] = owned.map(
      (event) => ({ event, role: "owner" }),
    );
    for (const { eventId } of joined) {
      const event = await ctx.db.get("events", eventId);
      if (event) events.push({ event, role: "partner" });
    }
    return await Promise.all(
      events.map(async ({ event, role }) => {
        const invite = await inviteOf(ctx, event._id);
        return {
          eventId: event._id,
          occasion: event.occasion,
          hosts: hosts(event),
          role,
          invite: invite
            ? {
                slug: invite.slug,
                published: Boolean(invite.published),
                unlocked: Boolean(invite.unlocked),
              }
            : null,
        };
      }),
    );
  },
});

/**
 * What the digital invitation's page in the shop shows of the event the
 * studio sent the couple with: whose it is and when, the card guests see,
 * and whether it's open to all of them already. It's what the couple's
 * guests see, for whoever has the event's id, as the couple's own cart does.
 */
export const forShop = query({
  args: { eventId: v.string() },
  returns: v.union(eventForShopValidator, v.null()),
  handler: async (ctx, args) => {
    const eventId = ctx.db.normalizeId("events", args.eventId);
    return eventId ? await eventForShop(ctx, eventId) : null;
  },
});

/** The design as guests will see it, copied from the couple's design. */
function publication(design: Doc<"designs">, now: number) {
  return {
    designId: design._id,
    revision: design.revision,
    document: design.document as DesignDocument,
    at: now,
  };
}

/**
 * Starts the event's digital invitation with one of its invitation designs,
 * in that design's language: guests see it as it is now.
 */
export const create = mutation({
  args: { eventId: v.id("events"), designId: v.id("designs") },
  returns: v.id("invites"),
  handler: async (ctx, args) => {
    const { event } = await requireEvent(ctx, args.eventId);
    const design = await invitationDesign(ctx, event, args.designId);
    const document = design.document as DesignDocument;
    const invite = await ensureInvite(ctx, event, document.language);
    if (!invite.published)
      await ctx.db.patch("invites", invite._id, {
        published: publication(design, Date.now()),
        updatedAt: Date.now(),
      });
    return invite._id;
  },
});

/**
 * Shows guests a design as it is now: the one they saw, after the couple
 * changed it, or another of the event's invitations. The studio then sends
 * a picture of it (attachImage).
 */
export const publish = mutation({
  args: { inviteId: v.id("invites"), designId: v.id("designs") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { event, invite } = await requireInvite(ctx, args.inviteId);
    const design = await invitationDesign(ctx, event, args.designId);
    const old = invite.published?.image;
    const now = Date.now();
    await ctx.db.patch("invites", invite._id, {
      published: publication(design, now),
      updatedAt: now,
    });
    if (old) await ctx.storage.delete(old);
    return null;
  },
});

/**
 * Keeps the studio's picture of the published design, which link previews
 * on WhatsApp and the invitation's emails show. It's for the design and
 * revision the studio drew: one published since waits for its own.
 */
export const attachImage = action({
  args: {
    inviteId: v.id("invites"),
    designId: v.id("designs"),
    revision: v.number(),
    image: v.bytes(),
  },
  returns: v.null(),
  handler: async (ctx, args): Promise<null> => {
    const type = imageType(args.image);
    if (!type || args.image.byteLength > MAX_IMAGE_BYTES)
      throw new ConvexError(errors.invalidImage);
    await ctx.runQuery(internal.invites.image.check, {
      inviteId: args.inviteId,
    });
    const image = await ctx.storage.store(new Blob([args.image], { type }));
    const kept: boolean = await ctx.runMutation(internal.invites.image.set, {
      inviteId: args.inviteId,
      designId: args.designId,
      revision: args.revision,
      image,
    });
    if (!kept) await ctx.storage.delete(image);
    return null;
  },
});

/** Changes how the invitation's page reads and what its form asks. */
export const update = mutation({
  args: {
    inviteId: v.id("invites"),
    open: v.optional(v.boolean()),
    questions: v.optional(questionsValidator),
    note: v.optional(v.string()),
    language: v.optional(languageValidator),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { invite } = await requireInvite(ctx, args.inviteId);
    const note = args.note?.trim();
    if (note && note.length > LENGTHS.note)
      throw new ConvexError(errors.invalidInput);
    await ctx.db.patch("invites", invite._id, {
      ...(args.open !== undefined && { open: args.open }),
      ...(args.questions && { questions: cleanQuestions(args.questions) }),
      ...(args.note !== undefined && { note: note || undefined }),
      ...(args.language && { language: args.language }),
      updatedAt: Date.now(),
    });
    return null;
  },
});

/**
 * Gives the invitation another address. Links already sent with the old
 * one stop working, which the studio says before it asks.
 */
export const setSlug = mutation({
  args: { inviteId: v.id("invites"), slug: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { invite } = await requireInvite(ctx, args.inviteId);
    const slug = args.slug.trim().toLowerCase();
    if (slug === invite.slug) return null;
    if (!isSlug(slug)) throw new ConvexError(errors.invalidSlug);
    const taken = await ctx.db
      .query("invites")
      .withIndex("by_slug", (q) => q.eq("slug", slug))
      .first();
    if (taken) throw new ConvexError(errors.slugTaken);
    await ctx.db.patch("invites", invite._id, { slug, updatedAt: Date.now() });
    return null;
  },
});

/**
 * A new link for the couple's partner to manage the invitation with them,
 * replacing the one before; or none, ending it. Partners who joined stay.
 */
export const setPartnerLink = mutation({
  args: { inviteId: v.id("invites"), on: v.boolean() },
  returns: v.union(v.string(), v.null()),
  handler: async (ctx, args) => {
    const { user, invite } = await requireInvite(ctx, args.inviteId);
    if (args.on) {
      const limit = await rateLimiter.limit(ctx, "partnerLink", {
        key: user._id,
      });
      if (!limit.ok) throw new ConvexError(errors.tooMany);
    }
    const code = args.on ? partnerCode() : undefined;
    await ctx.db.patch("invites", invite._id, {
      partnerCode: code,
      updatedAt: Date.now(),
    });
    return code ?? null;
  },
});

/**
 * The latest replies, newest first, with the families they came from: the
 * history under the couple's guest list.
 */
export const history = query({
  args: { inviteId: v.id("invites") },
  returns: v.array(
    v.object({
      _id: v.id("replies"),
      householdId: v.id("households"),
      household: v.string(),
      reply: replyValidator,
    }),
  ),
  handler: async (ctx, { inviteId }) => {
    const user = await viewerAccount(ctx);
    const invite = await ctx.db.get("invites", inviteId);
    const event = invite && (await ctx.db.get("events", invite.eventId));
    if (!user || !invite || !event || !(await eventRole(ctx, event, user._id)))
      return [];
    const replies = await ctx.db
      .query("replies")
      .withIndex("by_inviteId", (q) => q.eq("inviteId", inviteId))
      .order("desc")
      .take(50);
    const named = await Promise.all(
      replies.map(async (entry) => {
        const household = await ctx.db.get("households", entry.householdId);
        return household
          ? {
              _id: entry._id,
              householdId: entry.householdId,
              household: household.name,
              reply: entry.reply,
            }
          : null;
      }),
    );
    return named.filter((entry) => entry !== null);
  },
});

/**
 * Emails families their invitation, from the couple's names at Jolene's
 * address, with replies going to the couple. Families without an email are
 * left out. Before the invitation is paid for, only the trial families get
 * one, and an account sends a few a day.
 */
export const sendEmails = mutation({
  args: {
    inviteId: v.id("invites"),
    householdIds: v.array(v.id("households")),
  },
  returns: v.number(),
  handler: async (ctx, args) => {
    const { user, event, invite } = await requireInvite(ctx, args.inviteId);
    const base = inviteBaseUrl();
    if (!base || !invite.published) throw new ConvexError(errors.notFound);
    const allowed = invite.unlocked
      ? null
      : new Set((await trialHouseholds(ctx, invite)).map(({ _id }) => _id));
    const people = await managers(ctx, event);
    const replyTo = people
      .map((person) => person.email)
      .filter((email): email is string => Boolean(email));
    const image = invite.published.image
      ? await ctx.storage.getUrl(invite.published.image)
      : null;
    const { address } = sender();
    const now = Date.now();
    let sent = 0;
    for (const householdId of new Set(args.householdIds)) {
      const household = await ctx.db.get("households", householdId);
      if (!household || household.inviteId !== invite._id || !household.email)
        continue;
      if (allowed && !allowed.has(household._id))
        throw new ConvexError(errors.inviteLocked);
      const limit = await rateLimiter.limit(ctx, "inviteEmails", {
        key: invite._id,
      });
      if (!limit.ok) throw new ConvexError(errors.tooMany);
      if (allowed) {
        const mine = await rateLimiter.limit(ctx, "trialEmail", {
          key: user._id,
        });
        const everyone = await rateLimiter.limit(ctx, "trialEmails");
        if (!mine.ok || !everyone.ok) throw new ConvexError(errors.trialEmails);
      }
      const language = household.language ?? invite.language;
      const email = invitationEmail({
        occasion: event.occasion,
        fields: event.fields,
        language,
        household: household.name,
        link: householdLink(base, invite.slug, household.code),
        image,
      });
      const emailId = await sendEmail(ctx, {
        to: household.email,
        from: fromHeader(email.names || "Jolene", address),
        subject: email.subject,
        text: email.text,
        html: emailLayout(email.html, email.footer),
        replyTo,
      });
      await ctx.db.insert("inviteEmails", {
        inviteId: invite._id,
        householdId: household._id,
        emailId,
        to: household.email,
        status: "queued",
        updatedAt: now,
      });
      await ctx.db.patch("households", household._id, {
        sent: { by: "email", at: now },
        emailed: { status: "queued", at: now },
        updatedAt: now,
      });
      sent++;
    }
    return sent;
  },
});
