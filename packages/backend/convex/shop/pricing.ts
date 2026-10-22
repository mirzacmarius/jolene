import { type Infer, v } from "convex/values";
import type { Doc } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import type { answerValidator, pickedValidator } from "./validators";

/** The most of one line a cart holds, as jolene.ro took. */
export const MAX_QUANTITY = 999;

/**
 * Why a line can't be ordered as it is: its product is off sale, it's under
 * the product's minimum order, an option has no answer, an answer is no
 * longer one of its choices, as when Jolene renames one, or the digital
 * invitation it buys is already unlocked.
 */
export const lineProblemValidator = v.union(
  v.object({ kind: v.literal("unavailable") }),
  v.object({ kind: v.literal("minimum"), minQuantity: v.number() }),
  v.object({ kind: v.literal("missing"), label: v.string() }),
  v.object({ kind: v.literal("changed"), label: v.string() }),
  v.object({ kind: v.literal("unlocked") }),
);

export type Picked = Infer<typeof pickedValidator>;
export type Answer = Infer<typeof answerValidator>;
export type LineProblem = Infer<typeof lineProblemValidator>;

/** What a line asks of its product, as the couple chose it. */
export type LineChoices = {
  quantity: number;
  options: Picked[];
  answers: Answer[];
  fees: string[];
};

/** A product with the order options and fees it lists. */
export type PricedProduct = {
  product: Doc<"products">;
  lineOptions: Doc<"lineOptions">[];
  fees: Doc<"fees">[];
};

/**
 * Reads the order options and fees a product lists, in its order. One the
 * product names but the catalog no longer has is left out.
 */
export async function loadProduct(
  ctx: QueryCtx,
  product: Doc<"products">,
): Promise<PricedProduct> {
  const [lineOptions, fees] = await Promise.all([
    Promise.all(
      product.lineOptions.map((handle) =>
        ctx.db
          .query("lineOptions")
          .withIndex("by_handle", (q) => q.eq("handle", handle))
          .unique(),
      ),
    ),
    Promise.all(
      product.fees.map((key) =>
        ctx.db
          .query("fees")
          .withIndex("by_key", (q) => q.eq("key", key))
          .unique(),
      ),
    ),
  ]);
  return {
    product,
    lineOptions: lineOptions.flatMap((option) => (option ? [option] : [])),
    fees: fees.flatMap((fee) => (fee ? [fee] : [])),
  };
}

/** What a product's price reads of it, as the cart and the studio have it. */
export type Pricing = {
  product: Pick<Doc<"products">, "price" | "compareAtPrice" | "options">;
  lineOptions: Pick<Doc<"lineOptions">, "key" | "kind" | "choices">[];
};

/**
 * What one of a line costs, in bani: the product's price, its options'
 * surcharges and its paid choices. Values and choices that aren't the
 * product's add nothing; `problems` names them. The studio prices a
 * design's picks with it too (ADR 0021).
 */
export function unitPrice(
  { product, lineOptions }: Pricing,
  line: Pick<LineChoices, "options" | "answers">,
) {
  const surcharges = product.options.reduce((sum, option) => {
    const picked = line.options.find((o) => o.name === option.name);
    const value = option.values.find((v) => v.name === picked?.value);
    return sum + (value?.surcharge ?? 0);
  }, 0);
  const extras = lineOptions.reduce((sum, option) => {
    if (option.kind !== "select") return sum;
    const answer = line.answers.find((a) => a.key === option.key);
    const choice = option.choices.find((c) => c.label === answer?.value);
    return sum + (choice?.price ?? 0);
  }, 0);
  return {
    price: product.price + surcharges + extras,
    compareAtPrice:
      product.compareAtPrice === undefined
        ? undefined
        : product.compareAtPrice + surcharges + extras,
  };
}

/**
 * Why a line can't be ordered as it is, if anything stops it. A product
 * bought for an event, as the digital invitation is, also needs its event,
 * with the invitation not yet open to every guest. A line with a proof
 * needs no text answered: the proof has the couple's own (ADR 0021).
 */
export function problems(
  { product, lineOptions }: PricedProduct,
  line: LineChoices & Pick<Doc<"cartLines">, "proofId">,
  event?: { unlocked: boolean } | null,
): LineProblem[] {
  if (!product.published) return [{ kind: "unavailable" }];
  if (product.forEvent) {
    if (!event) return [{ kind: "unavailable" }];
    if (event.unlocked) return [{ kind: "unlocked" }];
  }
  const found: LineProblem[] = [];
  for (const option of product.options) {
    const picked = line.options.find((o) => o.name === option.name);
    if (!picked) found.push({ kind: "missing", label: option.name });
    else if (!option.values.some((value) => value.name === picked.value))
      found.push({ kind: "changed", label: option.name });
  }
  for (const option of lineOptions) {
    const answer = line.answers.find((a) => a.key === option.key)?.value;
    if (!answer) {
      const answered = line.proofId !== undefined && option.kind === "text";
      if (option.required && !answered)
        found.push({ kind: "missing", label: option.label });
    } else if (
      option.kind === "select" &&
      !option.choices.some((choice) => choice.label === answer)
    )
      found.push({ kind: "changed", label: option.label });
  }
  if (product.minQuantity !== undefined && line.quantity < product.minQuantity)
    found.push({ kind: "minimum", minQuantity: product.minQuantity });
  return found;
}

/**
 * The fees an order of these lines pays, each once: those a line chose that
 * its product lists.
 */
export function orderFees(
  lines: { product: PricedProduct; choices: LineChoices }[],
): Doc<"fees">[] {
  const fees = new Map<string, Doc<"fees">>();
  for (const { product, choices } of lines)
    for (const fee of product.fees)
      if (choices.fees.includes(fee.key)) fees.set(fee.key, fee);
  return [...fees.values()];
}

/**
 * A line as the couple sent it, kept to what its product asks: an answer
 * is trimmed, an empty one dropped, and a fee kept only if the product
 * lists it. Null if it asks something the product doesn't.
 */
export function normalizeLine(
  { product, lineOptions, fees }: PricedProduct,
  line: LineChoices,
): LineChoices | null {
  if (
    !Number.isInteger(line.quantity) ||
    line.quantity < 1 ||
    line.quantity > MAX_QUANTITY
  )
    return null;
  const names = new Set(line.options.map((o) => o.name));
  if (
    names.size !== line.options.length ||
    !line.options.every((o) => product.options.some((p) => p.name === o.name))
  )
    return null;
  const keys = new Set(line.answers.map((a) => a.key));
  if (
    keys.size !== line.answers.length ||
    !line.answers.every((a) => lineOptions.some((o) => o.key === a.key))
  )
    return null;
  if (!line.fees.every((key) => fees.some((fee) => fee.key === key)))
    return null;
  return {
    quantity: line.quantity,
    options: product.options.flatMap((option) =>
      line.options.filter((o) => o.name === option.name),
    ),
    answers: lineOptions.flatMap((option) =>
      line.answers
        .filter((a) => a.key === option.key)
        .map((a) => ({ key: a.key, value: a.value.trim() }))
        .filter((a) => a.value !== ""),
    ),
    fees: fees.flatMap((fee) => (line.fees.includes(fee.key) ? [fee.key] : [])),
  };
}
