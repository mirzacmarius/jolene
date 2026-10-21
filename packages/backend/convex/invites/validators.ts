import { type Infer, v } from "convex/values";
import { languageValidator } from "../utils/validators";

/** Whose guests a family is: the first partner's, the second's, or both. */
export const sideValidator = v.union(
  v.literal("partner1"),
  v.literal("partner2"),
  v.literal("both"),
);

/** How the couple sent a family their link. */
export const channelValidator = v.union(
  v.literal("whatsapp"),
  v.literal("sms"),
  v.literal("email"),
  v.literal("link"),
);

/** One person a family's reply says comes. */
export const guestValidator = v.object({
  /** Left empty when the family didn't name them. */
  name: v.string(),
  child: v.boolean(),
  /** One of the invitation's meals, when it asks. */
  meal: v.optional(v.string()),
  /** Comes as the family's plus-one, not one of the family invited. */
  plusOne: v.optional(v.literal(true)),
});

/** What a family answers, as they send it. */
export const replyInputValidator = v.object({
  coming: v.boolean(),
  /** Who comes, when they do; empty when they don't. */
  guests: v.array(guestValidator),
  /** Food they can't eat, when the invitation asks. Only the couple sees it. */
  allergies: v.optional(v.string()),
  /** A few words for the couple. */
  message: v.optional(v.string()),
});

/** A family's reply as kept: what they answered, who wrote it and when. */
export const replyValidator = v.object({
  ...replyInputValidator.fields,
  /** The family through their link, or the couple, for a reply they took. */
  by: v.union(v.literal("guest"), v.literal("couple")),
  at: v.number(),
});

export type ReplyInput = Infer<typeof replyInputValidator>;
export type Reply = Infer<typeof replyValidator>;

/** What the reply form asks besides who comes. */
export const questionsValidator = v.object({
  /** The meals guests choose from, in the invitation's language; none asks nothing. */
  meals: v.array(v.string()),
  /** Ask for food guests can't eat. */
  allergies: v.boolean(),
});

export type Questions = Infer<typeof questionsValidator>;

/**
 * How a digital invitation opens to guests: paid for, or free with printed
 * invitations, by the order that did it.
 */
export const unlockValidator = v.object({
  by: v.union(v.literal("order"), v.literal("print")),
  /** The Shopify order's name, such as #1042. */
  order: v.string(),
  at: v.number(),
});

/** Where an email to a family has got to, as Resend tells it. */
export const emailStatusValidator = v.union(
  v.literal("queued"),
  v.literal("sent"),
  v.literal("delivered"),
  v.literal("bounced"),
  v.literal("complained"),
  v.literal("failed"),
);

/** A family as the couple writes them on their guest list. */
export const householdInputValidator = v.object({
  name: v.string(),
  seats: v.number(),
  plusOne: v.boolean(),
  side: v.optional(sideValidator),
  phone: v.optional(v.string()),
  email: v.optional(v.string()),
  language: v.optional(languageValidator),
  note: v.optional(v.string()),
});

export type HouseholdInput = Infer<typeof householdInputValidator>;
