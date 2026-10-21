/**
 * Codes a ConvexError carries to the studio, which tells the visitor what
 * happened in their own language.
 */
export const errors = {
  /** No session: the studio signs the visitor in and tries again. */
  signedOut: "signed-out",
  /** Missing, or someone else's: the two read the same from outside. */
  notFound: "not-found",
  /** A detail the occasion doesn't have, or a value it can't hold. */
  invalidField: "invalid-field",
  /** The AI designer isn't set up on this deployment yet. */
  aiUnavailable: "ai-unavailable",
  /** The visitor has sent the AI designer as many messages as a day allows. */
  aiLimit: "ai-limit",
  /** All visitors together have: the AI designer is back tomorrow. */
  aiLimitTotal: "ai-limit-total",
  /** The AI designer is still answering the design's latest message. */
  aiBusy: "ai-busy",
  /** A message to the AI designer that is empty or too long. */
  aiInvalidMessage: "ai-invalid-message",
  /** A picture that isn't a PNG or a JPEG, or is too large to keep. */
  invalidImage: "invalid-image",
  /** A product that is off sale or doesn't exist. */
  productUnavailable: "product-unavailable",
  /**
   * A cart line asking what its product doesn't: an option it doesn't have,
   * a value or choice it doesn't offer, a quantity out of range, a fee it
   * doesn't list, or a proof of another product.
   */
  invalidLine: "invalid-line",
} as const;
