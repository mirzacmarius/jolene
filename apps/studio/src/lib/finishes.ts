import type { api } from "@jolene/backend/convex/_generated/api";
import type { Finishes } from "@jolene/backend/convex/designs/finishes";
import { unitPrice } from "@jolene/backend/convex/shop/pricing";
import {
  type DesignDocument,
  type Look,
  type ProductKind,
  showsLook,
} from "@jolene/design";
import type { FunctionReturnType } from "convex/server";

/** A template's product as the studio asks its order (catalog.product). */
export type OrderedProduct = NonNullable<
  FunctionReturnType<typeof api.catalog.product>
>;
export type ProductOption = OrderedProduct["options"][number];
export type ProductValue = ProductOption["values"][number];
export type LineOption = OrderedProduct["lineOptions"][number];
export type Choice = LineOption["choices"][number];

/**
 * Whether the couple may leave an order option out though none of its
 * choices is free, as the shop's "Nu doresc" does.
 */
export const canSkip = (option: LineOption) =>
  option.kind === "select" &&
  !option.required &&
  !option.choices.some((choice) => choice.price === 0);

/** Whether the design shows what choosing it does, or it does nothing. */
const seen = (document: DesignDocument, item: { look: Look | null }) =>
  item.look === null || showsLook(document, item.look);

/** The first of them whose look the design shows. */
const firstShown = <T extends { look: Look | null }>(
  document: DesignDocument,
  items: readonly T[],
) => items.find((item) => item.look !== null && showsLook(document, item.look));

/**
 * The value of one of the product's options, such as its paper, that the
 * couple orders (ADR 0021): theirs while the design shows it, else the first
 * the design shows, as several can look the same. Undefined when it shows
 * none, so they pick one. An option whose values change nothing takes the
 * shop's first.
 */
export function orderedValue(
  document: DesignDocument,
  option: ProductOption,
  picked: string | undefined,
): ProductValue | undefined {
  const own = option.values.find((value) => value.name === picked);
  if (own && seen(document, own)) return own;
  if (option.values.some((value) => value.look !== null))
    return firstShown(document, option.values);
  return option.values[0];
}

/**
 * The choice of one of the product's order options that the couple orders,
 * as above; null when they leave it out. One whose choices change nothing
 * takes theirs, else what the shop starts with: the first free choice of
 * one they may leave out, nothing yet of one they must answer.
 */
export function orderedChoice(
  document: DesignDocument,
  option: LineOption,
  answer: string | undefined,
): Choice | null | undefined {
  if (answer === "" && canSkip(option)) return null;
  const own = option.choices.find((choice) => choice.label === answer);
  if (own && seen(document, own)) return own;
  if (option.choices.some((choice) => choice.look !== null))
    return firstShown(document, option.choices);
  if (option.required) return undefined;
  return option.choices.find((choice) => choice.price === 0) ?? null;
}

/** The order options the studio asks, which are chosen: the proof answers the text. */
export const chosenOptions = (product: OrderedProduct) =>
  product.lineOptions.filter(
    (option) => option.kind === "select" && option.choices.length > 0,
  );

/**
 * What the couple orders of their design: each option's value and each
 * order option's choice, how many, and what one and all of them cost, in
 * bani, as the cart prices them. `missing` names what's still to choose.
 */
export function orderOf(
  document: DesignDocument,
  product: OrderedProduct,
  finishes: Finishes | undefined,
) {
  const values = new Map(
    product.options.map((option) => [
      option.name,
      orderedValue(
        document,
        option,
        finishes?.options.find((picked) => picked.name === option.name)?.value,
      ),
    ]),
  );
  const choices = new Map(
    chosenOptions(product).map((option) => [
      option.key,
      orderedChoice(
        document,
        option,
        finishes?.answers.find((answer) => answer.key === option.key)?.value,
      ),
    ]),
  );
  const line = {
    options: product.options.flatMap((option) => {
      const value = values.get(option.name);
      return value ? [{ name: option.name, value: value.name }] : [];
    }),
    answers: [...choices].flatMap(([key, choice]) =>
      choice ? [{ key, value: choice.label }] : [],
    ),
  };
  const { price, compareAtPrice } = unitPrice(
    { product, lineOptions: product.lineOptions },
    line,
  );
  const minQuantity = product.minQuantity ?? 1;
  const quantity = Math.max(finishes?.quantity ?? minQuantity, minQuantity);
  return {
    values,
    choices,
    line,
    quantity,
    minQuantity,
    price,
    compareAtPrice,
    total: price * quantity,
    missing: [
      ...product.options
        .filter((option) => values.get(option.name) === undefined)
        .map((option) => option.name),
      ...chosenOptions(product)
        .filter((option) => choices.get(option.key) === undefined)
        .map((option) => option.label),
    ],
  };
}

export type Order = ReturnType<typeof orderOf>;

/** Items ordered one for each family on the guest list. */
const forFamilies: readonly ProductKind[] = [
  "invitation",
  "save-the-date",
  "rsvp",
  "money-envelope",
  "thank-you",
];

/** Items ordered one for each person. */
const forPeople: readonly ProductKind[] = ["menu", "place-card", "favor-tag"];

/**
 * How many the guest list says to order of an item, by its families or its
 * people; null for an item it doesn't count, such as a table number.
 */
export function guestCount(
  kind: ProductKind,
  list: { households: number; seats: number },
): { of: "families" | "people"; count: number } | null {
  if (forFamilies.includes(kind))
    return { of: "families", count: list.households };
  if (forPeople.includes(kind)) return { of: "people", count: list.seats };
  return null;
}
