import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

/** Orders Stripe was paid for that neither its webhook nor the couple's return recorded. */
crons.interval(
  "record paid checkouts",
  { hours: 1 },
  internal.checkout.reconcile,
  {},
);

/** Checkouts no one paid for. */
crons.interval(
  "forget unpaid checkouts",
  { hours: 24 },
  internal.checkout.forget,
  {},
);

export default crons;
