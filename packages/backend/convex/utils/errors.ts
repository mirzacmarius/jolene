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
   * doesn't list, a proof of another product, or an event it isn't for.
   */
  invalidLine: "invalid-line",
  /**
   * Needs an account, not an anonymous session: a guest list outlives this
   * browser. The studio asks the visitor to sign in.
   */
  accountNeeded: "account-needed",
  /** Emails can't go out from this deployment yet (no Resend key). */
  emailUnavailable: "email-unavailable",
  /** Asked too often; the same works again a little later. */
  tooMany: "too-many",
  /** The digital invitation's address is taken, or isn't one it can have. */
  slugTaken: "slug-taken",
  invalidSlug: "invalid-slug",
  /** A family, reply or setting it can't hold, such as a name too long. */
  invalidInput: "invalid-input",
  /** A digital invitation holds this many families at most. */
  tooManyHouseholds: "too-many-households",
  /**
   * The digital invitation isn't paid for yet: until it is, only the first
   * families can open it, for the couple to try.
   */
  inviteLocked: "invite-locked",
  /** The reply date has passed; the couple takes replies themselves now. */
  replyClosed: "reply-closed",
  /** Paying online isn't set up on this deployment yet (no Stripe key). */
  checkoutUnavailable: "checkout-unavailable",
  /**
   * Stripe's page opens only for the shop's server once SHOP_SECRET is set,
   * and the caller didn't send it.
   */
  shopOnly: "shop-only",
  /** A cart with nothing in it to pay for. */
  cartEmpty: "cart-empty",
  /** A cart line can't be ordered as it is: the cart says why. */
  cartNotReady: "cart-not-ready",
  /**
   * The cart charges for a digital invitation, and the couple hasn't agreed
   * to its unlocking right away, which ends their 14 days to withdraw.
   */
  unlockNowNeeded: "unlock-now-needed",
  /** The event's digital invitation is open to every guest already. */
  inviteUnlocked: "invite-unlocked",
  /** The workshop's pages are for the accounts in WORKSHOP_EMAILS alone. */
  workshopOnly: "workshop-only",
  /** Someone else changed the order's status first: the page shows theirs. */
  orderMoved: "order-moved",
} as const;
