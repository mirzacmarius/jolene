import { DAY, HOUR, MINUTE, RateLimiter } from "@convex-dev/rate-limiter";
import { components } from "../_generated/api";

/**
 * How often visitors may do what costs Jolene or bothers someone else:
 * emails sent, what guests write without signing in, calls to Stripe and
 * files stored.
 */
export const rateLimiter = new RateLimiter(components.rateLimiter, {
  /** Sign-in codes sent to one mailbox (accounts.ts). */
  signInCode: { kind: "token bucket", rate: 6, period: HOUR, capacity: 3 },
  /** Sign-in codes sent to anyone, so no one can mail the world through us. */
  signInCodes: { kind: "token bucket", rate: 600, period: HOUR, capacity: 60 },
  /** Replies sent through one family's link. */
  reply: { kind: "token bucket", rate: 30, period: HOUR, capacity: 10 },
  /** Families adding themselves through one invitation's open link. */
  join: { kind: "token bucket", rate: 120, period: HOUR, capacity: 40 },
  /** Emails of one invitation to its guests. */
  inviteEmails: {
    kind: "token bucket",
    rate: 600,
    period: HOUR,
    capacity: 600,
  },
  /**
   * Emails of invitations on trial that one account sends: enough for a
   * couple to try theirs on its first families, too few to mail strangers
   * through Jolene by changing those families' addresses.
   */
  trialEmail: { kind: "token bucket", rate: 10, period: DAY, capacity: 10 },
  /** Emails of invitations on trial that everyone sends, likewise. */
  trialEmails: { kind: "token bucket", rate: 300, period: DAY, capacity: 100 },
  /** Drawings of a design one visitor sends the AI designer (ai.uploadImage). */
  aiUpload: { kind: "token bucket", rate: 120, period: HOUR, capacity: 40 },
  /** Drawings everyone sends it, so no one fills Convex's storage through us. */
  aiUploads: { kind: "token bucket", rate: 1200, period: HOUR, capacity: 200 },
  /** Partner links a couple makes, each one replacing the one before. */
  partnerLink: { kind: "token bucket", rate: 10, period: MINUTE, capacity: 5 },
  /** Stripe checkout pages opened for one cart. */
  checkout: { kind: "token bucket", rate: 30, period: HOUR, capacity: 10 },
  /**
   * Stripe checkout pages opened for one visitor, by the address the shop's
   * server saw them at, once it sends one (SHOP_SECRET).
   */
  visitorCheckouts: {
    kind: "token bucket",
    rate: 30,
    period: HOUR,
    capacity: 10,
  },
  /** Stripe checkout pages opened for anyone, so no one floods Stripe through us. */
  checkouts: { kind: "token bucket", rate: 1200, period: HOUR, capacity: 60 },
  /** Returns from Stripe that Convex hasn't recorded yet, each a call to Stripe. */
  confirms: { kind: "token bucket", rate: 1200, period: HOUR, capacity: 60 },
});
