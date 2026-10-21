import { ConvexError, v } from "convex/values";
import Stripe from "stripe";
import { internal } from "./_generated/api";
import {
  type ActionCtx,
  action,
  internalAction,
  internalMutation,
  internalQuery,
} from "./_generated/server";
import { findCart, priceCart } from "./cart";
import { checkoutOpen } from "./checkout/open";
import {
  type CheckoutForStripe,
  checkoutForStripeValidator,
  paidSession,
  retrieveSession,
  sessionParams,
  stripe,
  stripeTaxReady,
  verifiedEvent,
} from "./checkout/stripe";
import { sameSecret, shopSecret, visitorKey } from "./checkout/visitor";
import { shopUrl } from "./orders/links";
import type { PaidSession } from "./orders/validators";
import { errors } from "./utils/errors";
import { rateLimiter } from "./utils/limits";
import { languageValidator } from "./utils/validators";

/**
 * The shop's checkout (ADR 0015). The couple pays on Stripe's page for their
 * cart as Convex priced it when they went to pay, and their order is recorded
 * once Stripe says it's paid. Three things bring that news, and whichever
 * comes first records it: Stripe's webhook, the couple coming back to the
 * shop, and an hourly look at the day's paid sessions.
 */

/** A Checkout Session's id, as Stripe writes it in the shop's return address. */
const SESSION_ID = /^cs_(test|live)_\w{1,250}$/;

/** How far back the hourly look goes: a Checkout Session lasts a day at most. */
const RECONCILE_WINDOW = 26 * 60 * 60 * 1000;

/** The most sessions one hourly look goes through. */
const RECONCILE_LIMIT = 1000;

/** Checkouts no one paid for are forgotten after this long. */
const KEEP_UNPAID = 30 * 24 * 60 * 60 * 1000;

/**
 * Prices a cart for Stripe and keeps it as a checkout: what the couple pays
 * for, and what their order holds once they have. Refuses a cart with
 * nothing in it, or with a line that can't be ordered as it is, and one
 * past its limit, its visitor's when the shop's server names them, or
 * everyone's.
 */
export const prepare = internalMutation({
  args: {
    token: v.string(),
    language: languageValidator,
    visitor: v.optional(v.string()),
  },
  returns: checkoutForStripeValidator,
  handler: async (ctx, { token, language, visitor }) => {
    const cart = await findCart(ctx, token);
    if (!cart) throw new ConvexError(errors.cartEmpty);
    if (
      !(await rateLimiter.limit(ctx, "checkout", { key: cart._id })).ok ||
      (visitor !== undefined &&
        !(await rateLimiter.limit(ctx, "visitorCheckouts", { key: visitor }))
          .ok) ||
      !(await rateLimiter.limit(ctx, "checkouts")).ok
    )
      throw new ConvexError(errors.tooMany);

    const priced = await priceCart(ctx, cart._id);
    if (priced.lines.length === 0) throw new ConvexError(errors.cartEmpty);
    if (priced.lines.some((line) => line.problems.length > 0))
      throw new ConvexError(errors.cartNotReady);
    const lines = priced.lines.map((line) => ({
      product: line.handle,
      title: line.title,
      quantity: line.quantity,
      options: line.options,
      answers: line.answers,
      ...(line.proof && { proof: line.proof.id }),
      ...(line.event && {
        event: { id: line.event.id, hosts: line.event.hosts[language] },
      }),
      price: line.price,
      total: line.total,
    }));
    const id = await ctx.db.insert("checkouts", {
      cartId: cart._id,
      cartLines: priced.lines.map((line) => line.id),
      lines,
      fees: priced.fees,
      subtotal: priced.total,
      language,
    });
    return {
      id,
      language,
      // Stripe fetches each picture itself, so only pictures on the web.
      lines: lines.map((line, index) => {
        const { proof, image } = priced.lines[index] ?? {};
        const picture = proof?.image ?? image?.url;
        return picture?.startsWith("https://")
          ? { ...line, image: picture }
          : line;
      }),
      fees: priced.fees,
      subtotal: priced.total,
    };
  },
});

/**
 * Opens Stripe's checkout page for a cart, priced as it is now, and returns
 * its address: the shop's server sends the couple there. Stripe Tax works
 * out the VAT in it once it's set up in Jolene's Stripe account. Once
 * SHOP_SECRET is set, it opens only for the shop's server, which sends the
 * secret and the visitor's address as `server`.
 */
export const start = action({
  args: {
    token: v.string(),
    language: languageValidator,
    server: v.optional(v.object({ secret: v.string(), visitor: v.string() })),
  },
  returns: v.string(),
  handler: async (ctx, { token, language, server }): Promise<string> => {
    const shop = shopUrl();
    if (!checkoutOpen() || !shop)
      throw new ConvexError(errors.checkoutUnavailable);
    const secret = shopSecret();
    if (secret && !sameSecret(server?.secret ?? "", secret))
      throw new ConvexError(errors.shopOnly);
    // Only the shop's server can say who the visitor is.
    const visitor = secret && server ? visitorKey(server.visitor) : undefined;
    const checkout: CheckoutForStripe = await ctx.runMutation(
      internal.checkout.prepare,
      { token, language, ...(visitor !== undefined && { visitor }) },
    );
    const client = stripe();
    const vat = await stripeTaxReady(client);
    const session = await client.checkout.sessions.create(
      sessionParams(checkout, shop, { vat }),
      { idempotencyKey: `checkout-${checkout.id}` },
    );
    if (!session.url)
      throw new Error(`Stripe gave checkout ${checkout.id} no page`);
    return session.url;
  },
});

/** Records a paid session's order; null for another deployment's session. */
async function record(ctx: ActionCtx, session: PaidSession) {
  return await ctx.runMutation(internal.orders.record, { session });
}

/**
 * Records the order of the Checkout Session the couple came back from,
 * unless something already has. Returns the order page's token, or null
 * while the session isn't paid and for a session that isn't this shop's.
 */
export const confirm = action({
  args: { session: v.string() },
  returns: v.union(v.string(), v.null()),
  handler: async (ctx, { session: id }): Promise<string | null> => {
    if (!SESSION_ID.test(id)) return null;
    const recorded = await ctx.runQuery(internal.orders.tokenOf, {
      session: id,
    });
    if (recorded || !checkoutOpen()) return recorded;
    if (!(await rateLimiter.limit(ctx, "confirms")).ok)
      throw new ConvexError(errors.tooMany);
    let session: Stripe.Checkout.Session;
    try {
      session = await retrieveSession(id);
    } catch (error) {
      // No such session in this Stripe account.
      if (error instanceof Stripe.errors.StripeInvalidRequestError) return null;
      throw error;
    }
    const paid = paidSession(session);
    return paid && (await record(ctx, paid));
  },
});

/** Whether a checkout is this deployment's and its order isn't recorded yet. */
export const pending = internalQuery({
  args: { checkout: v.string() },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const checkoutId = ctx.db.normalizeId("checkouts", args.checkout);
    return Boolean(checkoutId && (await ctx.db.get("checkouts", checkoutId)));
  },
});

/**
 * Records a session's order if it's paid and its checkout is waiting. A
 * webhook event's copy of the session is read again from Stripe: it lacks
 * the delivery's name, and may be out of date.
 */
async function recordIfPaid(
  ctx: ActionCtx,
  session: Stripe.Checkout.Session,
  { reread }: { reread: boolean },
) {
  const checkout = session.client_reference_id;
  if (
    !checkout ||
    !(await ctx.runQuery(internal.checkout.pending, { checkout }))
  )
    return null;
  const paid = paidSession(
    reread ? await retrieveSession(session.id) : session,
  );
  return paid && (await record(ctx, paid));
}

/**
 * For Stripe's webhook in http.ts: records the order of a Checkout Session
 * Stripe says is complete, or paid after it was. Answers 400 to a request
 * Stripe didn't sign; when Stripe can't be asked, the error answers 500 and
 * Stripe sends the event again later.
 */
export async function handleStripeWebhook(ctx: ActionCtx, request: Request) {
  const event = await verifiedEvent(
    await request.text(),
    request.headers.get("stripe-signature"),
  );
  if (!event) return new Response("Invalid signature", { status: 400 });
  if (
    event.type === "checkout.session.completed" ||
    event.type === "checkout.session.async_payment_succeeded"
  )
    await recordIfPaid(ctx, event.data.object, { reread: true });
  return new Response(null, { status: 200 });
}

/**
 * Records the orders of the day's paid sessions that neither the webhook nor
 * the couple's return did: a webhook that never came, a tab closed on
 * Stripe's page, or a preview, which has no webhook. Runs hourly (crons.ts).
 */
export const reconcile = internalAction({
  args: {},
  returns: v.number(),
  handler: async (ctx): Promise<number> => {
    if (!checkoutOpen()) return 0;
    const sessions = stripe().checkout.sessions.list({
      created: { gte: Math.floor((Date.now() - RECONCILE_WINDOW) / 1000) },
      status: "complete",
      limit: 100,
      expand: ["data.shipping_cost.shipping_rate"],
    });
    let seen = 0;
    let recorded = 0;
    for await (const session of sessions) {
      if (++seen > RECONCILE_LIMIT) break;
      if (await recordIfPaid(ctx, session, { reread: false })) recorded++;
    }
    if (recorded > 0)
      console.log(
        `The hourly check recorded ${recorded} paid order${recorded === 1 ? "" : "s"} nothing else had`,
      );
    return recorded;
  },
});

/** Forgets checkouts no one paid for, a batch at a time. Runs daily. */
export const forget = internalMutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const old = await ctx.db
      .query("checkouts")
      .withIndex("by_creation_time", (q) =>
        q.lt("_creationTime", Date.now() - KEEP_UNPAID),
      )
      .take(100);
    for (const checkout of old) await ctx.db.delete("checkouts", checkout._id);
    if (old.length === 100)
      await ctx.scheduler.runAfter(0, internal.checkout.forget, {});
    return null;
  },
});
