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
} as const;
