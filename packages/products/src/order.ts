/**
 * How an order carries what a couple chose (ADR 0008): the metafields and
 * metaobjects the shop reads a product's order options from, and the
 * attributes it writes on cart lines, which the workshop reads back from
 * the order. Shopify keeps underscored attributes off the checkout; the
 * order and the admin still show them.
 */

/** The namespace of the product metafields in `keys`. */
export const namespace = "jolene";

/** The metaobjects that line options and their choices are. */
export const types = {
  choice: "jolene_choice",
  lineOption: "jolene_line_option",
} as const;

/** The product metafields the shop reads, under `namespace`. */
export const keys = {
  lineOptions: "line_options",
  minQuantity: "min_quantity",
  fees: "fees",
} as const;

/** The product whose variants charge a line's extras. */
export const extrasHandle = "optiuni-suplimentare";

/**
 * The underscored attributes of a cart line. A product line's answers are
 * attributes too, each under its line option's label.
 */
export const attributes = {
  /**
   * On a product line with extras: an ID for the line and its answers,
   * which its extras line points to.
   */
  line: "_line",
  /** On a product line: the extras variant its paid choices add up to. */
  extras: "_extras",
  /** On a product line: the fee variants chosen with it, comma-separated. */
  fees: "_fees",
  /** On an extras line: the `line` of the product line it charges for. */
  extrasFor: "_extras_for",
  /** On a fee line. */
  fee: "_fee",
  /** On a designed line: the proof it's printed from (ADR 0007). */
  proof: "_proof",
} as const;

/**
 * The attribute beside `attributes.proof` that tells the customer, in the
 * cart and at checkout, when they approved the proof.
 */
export const proofNote = "Bun de tipar";
