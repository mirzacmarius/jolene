import { type Infer, v } from "convex/values";
import type { Answer, Picked } from "../shop/pricing";
import { answerValidator, pickedValidator } from "../shop/validators";

/**
 * What the couple picks to order a design on the studio's Finisaje tab (ADR
 * 0021), as the cart takes it: how many, its paper and its order options'
 * answers. A pick that shows on the design changes it as an edit does; this
 * keeps which one it was, as several can look the same, and the picks that
 * don't show, such as preserved flowers.
 */
export const finishesValidator = v.object({
  /** How many, once the couple changes it from the product's minimum. */
  quantity: v.optional(v.number()),
  /** A value for each of the product's options, such as its paper. */
  options: v.array(pickedValidator),
  /**
   * A choice's label for each order option the couple answered, by key;
   * empty for one they leave out, when it has no choice for none.
   */
  answers: v.array(answerValidator),
});

export type Finishes = Infer<typeof finishesValidator>;

/** The most picks a design keeps: far more than any product asks. */
export const MOST_PICKS = 40;

/** The longest a pick's name or value can be: a choice's label is 100. */
export const PICK_LENGTH = 200;

/**
 * The couple's picks with one more: how many, or a value or an answer,
 * which takes the place of theirs for the same option. The studio keeps its
 * cached design's picks with it too, as the backend does.
 */
export function withPick(
  finishes: Finishes | undefined,
  pick: { quantity?: number; option?: Picked; answer?: Answer },
): Finishes {
  const { quantity, option, answer } = pick;
  const before = finishes ?? { options: [], answers: [] };
  return {
    quantity: quantity ?? before.quantity,
    options: option
      ? [...before.options.filter((o) => o.name !== option.name), option]
      : before.options,
    answers: answer
      ? [...before.answers.filter((a) => a.key !== answer.key), answer]
      : before.answers,
  };
}
