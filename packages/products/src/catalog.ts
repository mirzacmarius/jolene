/**
 * jolene.ro's catalog as the shop sells it, lifted from the WooCommerce
 * shop by scripts/lift.ts and written to catalog/. Shopify gets it through
 * scripts/sync.ts; after that, Shopify's admin is where it changes. The
 * studio's seed loads it into Convex too (ADR 0015), which replaces Shopify.
 */

/** A product the shop sells, under the name it had on jolene.ro. */
export type Product = {
  handle: string;
  title: string;
  descriptionHtml: string;
  /** Lei each, before its options' surcharges. */
  price: number;
  /** The price before a sale, while the product is on sale. */
  compareAtPrice?: number;
  /**
   * What the product is made of, such as its paper, as Shopify's options:
   * a variant for each combination of values, priced with their surcharges.
   */
  options: ProductOption[];
  /** The handles of the options that go with the cart line, in order. */
  lineOptions: string[];
  /** The handles of its categories, their parents included. */
  categories: string[];
  tags: string[];
  images: Image[];
  /** The smallest quantity Jolene takes an order for. */
  minQuantity?: number;
  /** One-off charges the product can carry, such as for diacritics. */
  fees: FeeKey[];
  /** Where the product was in WooCommerce, for its redirect. */
  woo: { id: number; path: string };
};

export type ProductOption = {
  name: string;
  values: { name: string; surcharge: number }[];
};

/** A product's photo: where Shopify fetches it from, and what it shows. */
export type Image = { url: string; alt: string };

/**
 * An option a couple chooses or writes when they order, which goes with the
 * cart line: the seal's colour, the edges, a text. Products share one when
 * they ask the same with the same choices and prices, so a price changed in
 * Shopify changes for all of them.
 */
export type LineOption = {
  /** Unique in the catalog, and the option's metaobject handle in Shopify. */
  handle: string;
  /**
   * What the option asks, the same for every option that asks it, such as
   * "culoare-sigiliu": the shop fills it in from a design by it.
   */
  key: string;
  /** What couples read: "Culoare sigiliu". */
  label: string;
  /** A line under the label: "Textul ce va apărea pe plic." */
  hint?: string;
  kind: LineOptionKind;
  required: boolean;
  /** A select's choices, in order. */
  choices: Choice[];
};

export type LineOptionKind = "select" | "text" | "textarea" | "email";

/** One of a select's choices and what it adds to each one ordered, in lei. */
export type Choice = { label: string; price: number };

/**
 * A shelf of the shop, one of jolene.ro's categories, such as "Invitații
 * nuntă": a collection in Shopify.
 */
export type Category = { handle: string; title: string };

export type Catalog = {
  products: Product[];
  lineOptions: LineOption[];
  categories: Category[];
};

/**
 * The one-off charges jolene.ro's descriptions mention, each a variant of a
 * product of its own that the shop adds at quantity one, and what an order
 * calls it.
 */
export const fees = {
  "diacritice-50": {
    product: "diacritice",
    variant: "50 lei",
    price: 50,
    label: "Diacritice",
  },
  "diacritice-10": {
    product: "diacritice",
    variant: "10 lei",
    price: 10,
    label: "Diacritice",
  },
  "comanda-urgenta": {
    product: "comanda-urgenta",
    variant: "200 lei",
    price: 200,
    label: "Comandă urgentă",
  },
} as const;

export type FeeKey = keyof typeof fees;
