import type { Money } from "@/lib/money/types";

export type LineOptionKind = "email" | "select" | "text" | "textarea";

export interface LineOption {
  choices: LineOptionChoice[];
  hint?: string;
  key: string;
  kind: LineOptionKind;
  label: string;
  required: boolean;
}

export interface LineOptionChoice {
  label: string;
  /** Lei added to each one ordered, as Shopify writes decimals. */
  price: string;
}

export interface Fee {
  description: string;
  id: string;
  price: Money;
  title: string;
}

export interface ExtrasVariant {
  id: string;
  price: Money;
}

export interface ProductLineOptions {
  /** The extras product's variants this product's paid choices can add up to. */
  extras: ExtrasVariant[];
  fees: Fee[];
  minQuantity: number;
  options: LineOption[];
}

/** Each line option's answer, by its key. */
export type LineOptionAnswers = Record<string, string>;

export interface CartAttribute {
  key: string;
  value: string;
}
