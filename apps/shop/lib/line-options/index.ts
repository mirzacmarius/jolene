import type {
  CartAttribute,
  ExtrasVariant,
  Fee,
  LineOption,
  LineOptionAnswers,
  LineOptionChoice,
} from "./types";

// Shopify keeps underscored attributes off the checkout; the order and its webhooks still carry them.
export const LINE_ATTRIBUTE = "_line";
export const EXTRAS_ATTRIBUTE = "_extras";
export const FEES_ATTRIBUTE = "_fees";
export const EXTRAS_FOR_ATTRIBUTE = "_extras_for";
export const FEE_ATTRIBUTE = "_fee";

// packages/products puts the product that charges extras in the store under this handle.
export const EXTRAS_HANDLE = "optiuni-suplimentare";

export const MAX_QUANTITY = 999;

export function toBani(amount: number | string): number {
  return Math.round(Number(amount) * 100);
}

export function fromBani(bani: number): string {
  return (bani / 100).toFixed(2);
}

// A select the couple may skip starts on its first free choice, which is how jolene.ro lists "none".
export function getDefaultAnswers(options: LineOption[]): LineOptionAnswers {
  return Object.fromEntries(
    options.map((option) => [
      option.key,
      option.kind === "select" && !option.required
        ? (option.choices.find((choice) => toBani(choice.price) === 0)?.label ?? "")
        : "",
    ]),
  );
}

export function canSkipChoice(option: LineOption): boolean {
  return !option.required && !option.choices.some((choice) => toBani(choice.price) === 0);
}

function getChoice(option: LineOption, answer: string | undefined): LineOptionChoice | undefined {
  return option.choices.find((choice) => choice.label === answer);
}

/** What the chosen options add to each one ordered, in bani. */
export function getExtrasPerItem(options: LineOption[], answers: LineOptionAnswers): number {
  return options.reduce(
    (sum, option) => sum + toBani(getChoice(option, answers[option.key])?.price ?? 0),
    0,
  );
}

/** Every amount, in bani, that the options' choices can add up to. */
export function getReachableExtras(options: LineOption[]): Set<number> {
  let sums = new Set([0]);
  for (const option of options) {
    if (!option.choices.length) continue;
    const prices = new Set(option.choices.map((choice) => toBani(choice.price)));
    if (!option.required) prices.add(0);
    sums = new Set([...sums].flatMap((sum) => [...prices].map((price) => sum + price)));
  }
  return sums;
}

export function findExtrasVariant(
  extras: ExtrasVariant[],
  bani: number,
): ExtrasVariant | undefined {
  return extras.find((variant) => toBani(variant.price.amount) === bani);
}

export function getMissingOptions(options: LineOption[], answers: LineOptionAnswers): LineOption[] {
  return options.filter((option) => option.required && !answers[option.key]?.trim());
}

/** Answers that aren't one of their select's choices, as when Jolene renames a choice. */
export function getUnknownAnswers(options: LineOption[], answers: LineOptionAnswers): LineOption[] {
  return options.filter(
    (option) =>
      option.kind === "select" && answers[option.key] && !getChoice(option, answers[option.key]),
  );
}

// The same choices give the same line ID, so adding them again adds to the line Shopify already has.
export function getLineAttributes({
  answers,
  attributes = [],
  extras,
  fees,
  merchandiseId,
  options,
}: {
  answers: LineOptionAnswers;
  attributes?: CartAttribute[];
  extras: ExtrasVariant | undefined;
  fees: Fee[];
  merchandiseId: string;
  options: LineOption[];
}): CartAttribute[] {
  const lineAttributes = [
    ...attributes,
    ...options.flatMap((option) => {
      const value = answers[option.key]?.trim();
      return value ? [{ key: option.label, value }] : [];
    }),
    ...fees.map((fee) => ({ key: fee.title, value: "Da" })),
  ];
  if (fees.length)
    lineAttributes.push({ key: FEES_ATTRIBUTE, value: fees.map((fee) => fee.id).join(",") });
  if (!extras) return lineAttributes;
  lineAttributes.push({ key: EXTRAS_ATTRIBUTE, value: extras.id });
  return [
    ...lineAttributes,
    { key: LINE_ATTRIBUTE, value: hash(JSON.stringify([merchandiseId, lineAttributes])) },
  ];
}

function hash(text: string): string {
  let value = 0x811c9dc5;
  for (let index = 0; index < text.length; index++) {
    value ^= text.charCodeAt(index);
    value = Math.imul(value, 0x01000193);
  }
  return (value >>> 0).toString(36);
}

interface KeptLine {
  attributes?: ReadonlyArray<{ key: string; value?: string | null }> | null;
  id: string;
  merchandise?: {
    id?: string | null;
    product?: { title?: string | null } | null;
    title?: string | null;
  } | null;
  quantity: number;
}

export type CartLineChange =
  | { add: Array<{ attributes: CartAttribute[]; merchandiseId: string; quantity: number }> }
  | { update: { id: string; quantity: number } };

export function getLineAttribute(
  line: Pick<KeptLine, "attributes">,
  key: string,
): string | undefined {
  return line.attributes?.find((attribute) => attribute.key === key)?.value || undefined;
}

export function getLineRole(line: Pick<KeptLine, "attributes">): "extras" | "fee" | "product" {
  if (getLineAttribute(line, EXTRAS_FOR_ATTRIBUTE)) return "extras";
  if (getLineAttribute(line, FEE_ATTRIBUTE)) return "fee";
  return "product";
}

/** The products ordered, without the lines the cart keeps beside them. */
export function countProductLines(lines: ReadonlyArray<Pick<KeptLine, "attributes">>): number {
  return lines.filter((line) => getLineRole(line) === "product").length;
}

// Standard Actions batch only additions, so removals and updates go one at a time.
export function planCartChange(lines: readonly KeptLine[]): CartLineChange | undefined {
  const products = new Map<string, KeptLine>();
  const fees = new Set<string>();
  for (const line of lines) {
    if (getLineRole(line) !== "product") continue;
    const lineId = getLineAttribute(line, LINE_ATTRIBUTE);
    if (lineId && !products.has(lineId)) products.set(lineId, line);
    for (const fee of getLineAttribute(line, FEES_ATTRIBUTE)?.split(",") ?? [])
      if (fee) fees.add(fee);
  }

  const keptExtras = new Set<string>();
  const keptFees = new Set<string>();
  for (const line of lines) {
    const role = getLineRole(line);
    const merchandiseId = line.merchandise?.id ?? "";
    if (role === "extras") {
      const lineId = getLineAttribute(line, EXTRAS_FOR_ATTRIBUTE) ?? "";
      const product = products.get(lineId);
      if (
        !product ||
        keptExtras.has(lineId) ||
        getLineAttribute(product, EXTRAS_ATTRIBUTE) !== merchandiseId
      )
        return { update: { id: line.id, quantity: 0 } };
      keptExtras.add(lineId);
      if (line.quantity !== product.quantity)
        return { update: { id: line.id, quantity: product.quantity } };
    } else if (role === "fee") {
      if (!fees.has(merchandiseId) || keptFees.has(merchandiseId))
        return { update: { id: line.id, quantity: 0 } };
      keptFees.add(merchandiseId);
      if (line.quantity !== 1) return { update: { id: line.id, quantity: 1 } };
    }
  }

  const add = [
    ...[...products].flatMap(([lineId, product]) => {
      const extras = getLineAttribute(product, EXTRAS_ATTRIBUTE);
      if (!extras || keptExtras.has(lineId)) return [];
      return [
        {
          attributes: [
            { key: "Pentru", value: describeLine(product) },
            { key: EXTRAS_FOR_ATTRIBUTE, value: lineId },
          ],
          merchandiseId: extras,
          quantity: product.quantity,
        },
      ];
    }),
    ...[...fees]
      .filter((fee) => !keptFees.has(fee))
      .map((fee) => ({
        attributes: [{ key: FEE_ATTRIBUTE, value: "1" }],
        merchandiseId: fee,
        quantity: 1,
      })),
  ];
  return add.length ? { add } : undefined;
}

function describeLine({ merchandise }: KeptLine): string {
  const title = merchandise?.product?.title ?? "";
  const variant = merchandise?.title;
  return variant && variant !== "Default Title" ? `${title} (${variant})` : title;
}
