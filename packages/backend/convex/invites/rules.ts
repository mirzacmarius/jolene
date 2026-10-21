import type { Fields, Language } from "@jolene/design";
import { ConvexError } from "convex/values";
import type { Doc } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import { errors } from "../utils/errors";
import { romanianDate } from "./codes";
import type {
  HouseholdInput,
  Questions,
  Reply,
  ReplyInput,
} from "./validators";

/** The most families one digital invitation holds: a wedding of 1,500. */
export const MAX_HOUSEHOLDS = 600;

/** Families who can open a digital invitation before it's paid for. */
export const TRIAL_HOUSEHOLDS = 3;

/** The most people one family is invited as. */
export const MAX_SEATS = 12;

/** The longest of what couples and guests write, in characters. */
export const LENGTHS = {
  name: 120,
  guestName: 80,
  phone: 32,
  email: 254,
  householdNote: 500,
  note: 1200,
  meal: 60,
  allergies: 300,
  message: 1000,
} as const;

/** The most meals an invitation offers. */
export const MAX_MEALS = 6;

/** The meals an invitation offers at first, in its language. */
export function defaultMeals(language: Language): string[] {
  return language === "ro"
    ? ["Meniu standard", "Meniu vegetarian", "Meniu pentru copii"]
    : ["Standard", "Vegetarian", "Children's menu"];
}

function invalid(): never {
  throw new ConvexError(errors.invalidInput);
}

/** Text trimmed and no longer than `max`, or undefined when empty. */
function optionalText(value: string | undefined, max: number) {
  const trimmed = value?.trim();
  if (!trimmed) return undefined;
  if (trimmed.length > max) invalid();
  return trimmed;
}

const PHONE = /^\+?[0-9 ()./-]{6,}$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** A family as the couple wrote them, tidied, or invalid-input. */
export function cleanHousehold(input: HouseholdInput) {
  const name = input.name.trim();
  if (!name || name.length > LENGTHS.name) invalid();
  if (
    !Number.isInteger(input.seats) ||
    input.seats < 1 ||
    input.seats > MAX_SEATS
  )
    invalid();
  const phone = optionalText(input.phone, LENGTHS.phone);
  if (phone && !PHONE.test(phone)) invalid();
  const email = optionalText(input.email, LENGTHS.email)?.toLowerCase();
  if (email && !EMAIL.test(email)) invalid();
  return {
    name,
    seats: input.seats,
    plusOne: input.plusOne,
    side: input.side,
    phone,
    email,
    language: input.language,
    note: optionalText(input.note, LENGTHS.householdNote),
  };
}

/** What the reply form may ask, tidied, or invalid-input. */
export function cleanQuestions(questions: Questions): Questions {
  const meals = questions.meals.map((meal) => meal.trim()).filter(Boolean);
  if (
    meals.length > MAX_MEALS ||
    meals.some((meal) => meal.length > LENGTHS.meal) ||
    new Set(meals).size !== meals.length
  )
    invalid();
  return { meals, allergies: questions.allergies };
}

/**
 * A family's reply, checked against what they were invited as and what the
 * invitation asks: no more people than their seats and plus-one, meals the
 * invitation offers. Invalid-input otherwise.
 */
export function cleanReply(
  reply: ReplyInput,
  household: Pick<Doc<"households">, "seats" | "plusOne">,
  questions: Questions,
  by: Reply["by"],
  now: number,
): Reply {
  const message = optionalText(reply.message, LENGTHS.message);
  if (!reply.coming) return { coming: false, guests: [], message, by, at: now };
  if (reply.guests.length === 0) invalid();
  const plusOnes = reply.guests.filter((guest) => guest.plusOne).length;
  if (plusOnes > (household.plusOne ? 1 : 0)) invalid();
  if (reply.guests.length - plusOnes > household.seats) invalid();
  const guests = reply.guests.map((guest) => {
    const name = guest.name.trim();
    if (name.length > LENGTHS.guestName) invalid();
    const meal = guest.meal?.trim() || undefined;
    if (meal && !questions.meals.includes(meal)) invalid();
    return {
      name,
      child: guest.child,
      ...(meal && questions.meals.length > 0 ? { meal } : {}),
      ...(guest.plusOne ? { plusOne: true as const } : {}),
    };
  });
  return {
    coming: true,
    guests,
    allergies: questions.allergies
      ? optionalText(reply.allergies, LENGTHS.allergies)
      : undefined,
    message,
    by,
    at: now,
  };
}

/**
 * Whether the reply date has passed in Romania: guests reply until the end
 * of the day the couple wrote (the event's rsvpBy).
 */
export function repliesClosed(fields: Fields, now: number): boolean {
  const by = fields.rsvpBy?.trim();
  return Boolean(by) && romanianDate(now) > (by as string);
}

/**
 * The families who can open a digital invitation before it's paid for: the
 * first the couple added, for them to try it on.
 */
export async function trialHouseholds(ctx: QueryCtx, invite: Doc<"invites">) {
  return await ctx.db
    .query("households")
    .withIndex("by_inviteId", (q) => q.eq("inviteId", invite._id))
    .take(TRIAL_HOUSEHOLDS);
}

/** Whether a family can open the invitation: paid for, or one of the trial. */
export async function canOpen(
  ctx: QueryCtx,
  invite: Doc<"invites">,
  household: Doc<"households">,
) {
  if (invite.unlocked) return true;
  const trial = await trialHouseholds(ctx, invite);
  return trial.some((entry) => entry._id === household._id);
}

/** All of an invitation's families, in the order they were added. */
export async function householdsOf(ctx: QueryCtx, invite: Doc<"invites">) {
  return await ctx.db
    .query("households")
    .withIndex("by_inviteId", (q) => q.eq("inviteId", invite._id))
    .take(MAX_HOUSEHOLDS);
}
