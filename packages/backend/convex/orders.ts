import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc } from "./_generated/dataModel";
import {
  env,
  internalMutation,
  internalQuery,
  type QueryCtx,
  query,
} from "./_generated/server";
import { WORKSHOP_ADDRESS } from "./checkout/delivery";
import {
  emailConfigured,
  emailLayout,
  fromHeader,
  sendEmail,
  sender,
} from "./emails";
import { randomCode } from "./invites/codes";
import { eventForShop } from "./invites/shop";
import { unlockPaid } from "./invites/unlock";
import { confirmationEmail, noticeEmail } from "./orders/emails";
import { FIRST_ORDER, orderName } from "./orders/format";
import { orderUrl, shopUrl } from "./orders/links";
import {
  addressValidator,
  deliveryValidator,
  orderFeeValidator,
  orderLineValidator,
  paidSessionValidator,
} from "./orders/validators";
import { proofSummaryValidator, summarize } from "./proofs";
import { photoValidator, photoView } from "./shop/photos";
import { languageValidator } from "./utils/validators";

/**
 * Orders: what a couple paid for in one checkout (checkout.ts), kept as it
 * was priced and as Stripe charged it. The couple sees theirs on the order
 * page, by the link their emails carry.
 */

/** The order page's key: too long to guess, as anyone with it sees the order. */
const TOKEN_LENGTH = 32;

async function orderOfSession(ctx: QueryCtx, session: string) {
  return await ctx.db
    .query("orders")
    .withIndex("by_session", (q) => q.eq("session", session))
    .unique();
}

/**
 * Records a paid Checkout Session's order, once: its checkout's lines and
 * fees, who paid, where it goes and what Stripe charged. The paid lines
 * leave the cart. Returns the order page's token, or null for a session no
 * checkout of this deployment opened.
 */
export const record = internalMutation({
  args: { session: paidSessionValidator },
  returns: v.union(v.string(), v.null()),
  handler: async (ctx, { session }) => {
    const recorded = await orderOfSession(ctx, session.id);
    if (recorded) return recorded.token;
    const checkoutId = ctx.db.normalizeId("checkouts", session.checkout);
    const checkout = checkoutId && (await ctx.db.get("checkouts", checkoutId));
    if (!checkout) return null;
    if (session.subtotal !== checkout.subtotal)
      console.warn(
        `Checkout ${checkout._id} was priced at ${checkout.subtotal} bani and Stripe charged ${session.subtotal} for it`,
      );

    const last = await ctx.db
      .query("orders")
      .withIndex("by_number")
      .order("desc")
      .first();
    const number = Math.max(FIRST_ORDER, (last?.number ?? 0) + 1);
    const token = randomCode(TOKEN_LENGTH);
    const orderId = await ctx.db.insert("orders", {
      number,
      token,
      session: session.id,
      ...(session.paymentIntent && { paymentIntent: session.paymentIntent }),
      test: session.test,
      language: checkout.language,
      lines: checkout.lines,
      fees: checkout.fees,
      subtotal: checkout.subtotal,
      ...(session.delivery && { delivery: session.delivery }),
      discount: session.discount,
      total: session.total,
      ...(session.vat !== undefined && { vat: session.vat }),
      customer: session.customer,
      ...(session.address && { address: session.address }),
      paidAt: Date.now(),
    });
    for (const lineId of checkout.cartLines)
      if (await ctx.db.get("cartLines", lineId))
        await ctx.db.delete("cartLines", lineId);
    await ctx.db.delete("checkouts", checkout._id);

    // In the order's transaction (ADR 0014), as a subtransaction: an unlock
    // that fails rolls back alone, never the paid order.
    try {
      await ctx.runMutation(internal.orders.unlock, { orderId });
    } catch (error) {
      console.error(
        `Order ${orderName(number)} couldn't unlock the digital invitation it paid for, so Jolene's team unlocks it by hand: ${String(error)}`,
      );
    }
    await ctx.scheduler.runAfter(0, internal.orders.sendEmails, { orderId });
    console.log(
      `Order ${orderName(number)} paid${session.test ? " in Stripe's test mode" : ""}`,
    );
    return token;
  },
});

/** The order page's token of a session's order, once it's recorded. */
export const tokenOf = internalQuery({
  args: { session: v.string() },
  returns: v.union(v.string(), v.null()),
  handler: async (ctx, { session }) =>
    (await orderOfSession(ctx, session))?.token ?? null,
});

/** Opens what an order paid for, such as an event's digital invitation. */
export const unlock = internalMutation({
  args: { orderId: v.id("orders") },
  returns: v.null(),
  handler: async (ctx, { orderId }) => {
    const order = await ctx.db.get("orders", orderId);
    if (!order) return null;
    await unlockPaid(
      ctx,
      orderName(order.number),
      order.lines.map(({ product, quantity, proof, event }) => ({
        product,
        quantity,
        ...(proof && { proof }),
        ...(event && { event: event.id }),
      })),
    );
    return null;
  },
});

/**
 * The pictures of an order's lines: the couple's design, the invitation
 * guests see for a line bought for an event, or the product's photo.
 */
async function linePictures(ctx: QueryCtx, order: Doc<"orders">) {
  return await Promise.all(
    order.lines.map(async (line) => {
      const proof = line.proof && (await summarize(ctx, line.proof));
      const event = line.event && (await eventForShop(ctx, line.event.id));
      const product = await ctx.db
        .query("products")
        .withIndex("by_handle", (q) => q.eq("handle", line.product))
        .unique();
      const photo = product?.images[0];
      return {
        proof: line.proof && proof ? { id: line.proof, ...proof } : undefined,
        image:
          line.event && event?.image
            ? { url: event.image, alt: line.event.hosts }
            : photo
              ? await photoView(ctx, photo)
              : null,
      };
    }),
  );
}

/**
 * Emails the couple their order's confirmation, in the language they paid
 * in, and tells Jolene's team of it. Without Resend, only the logs hear of it.
 */
export const sendEmails = internalMutation({
  args: { orderId: v.id("orders") },
  returns: v.null(),
  handler: async (ctx, { orderId }) => {
    const order = await ctx.db.get("orders", orderId);
    if (!order) return null;
    if (!emailConfigured()) {
      console.log(
        `Order ${orderName(order.number)} sent no emails: RESEND_API_KEY isn't set`,
      );
      return null;
    }
    const shop = shopUrl();
    const link = shop && orderUrl(shop, order.token);
    const pictures = await linePictures(ctx, order);
    const { name, address } = sender();
    const from = fromHeader(name, address);
    const team = env.ORDERS_EMAIL?.trim() || address;
    if (order.customer.email) {
      const email = confirmationEmail(
        order,
        link,
        pictures.map(({ proof, image }) => proof?.image ?? image?.url ?? null),
      );
      await sendEmail(ctx, {
        to: order.customer.email,
        from,
        subject: email.subject,
        text: email.text,
        html: emailLayout(email.html, email.footer),
        replyTo: [team],
        idempotencyKey: `order-${order._id}`,
      });
    }
    const notice = noticeEmail(order, link);
    await sendEmail(ctx, {
      to: team,
      from,
      subject: notice.subject,
      text: notice.text,
      html: emailLayout(notice.html, notice.footer),
      ...(order.customer.email && { replyTo: [order.customer.email] }),
      idempotencyKey: `order-${order._id}-team`,
    });
    return null;
  },
});

const orderViewValidator = v.object({
  /** What the couple and the workshop call it, as J1001. */
  name: v.string(),
  /** Paid in Stripe's test mode: a trial, not a sale. */
  test: v.boolean(),
  paidAt: v.number(),
  language: languageValidator,
  lines: v.array(
    orderLineValidator.omit("proof").extend({
      image: v.union(photoValidator, v.null()),
      proof: v.optional(
        v.object({ id: v.id("proofs"), ...proofSummaryValidator.fields }),
      ),
    }),
  ),
  fees: v.array(orderFeeValidator),
  subtotal: v.number(),
  delivery: v.optional(deliveryValidator),
  discount: v.number(),
  total: v.number(),
  /** The VAT in the total, when Stripe Tax worked it out. */
  vat: v.optional(v.number()),
  customer: v.object({ name: v.string(), email: v.string() }),
  address: v.optional(addressValidator),
  /** Where the couple picks it up, when they chose to: the workshop. */
  pickupAt: v.optional(v.string()),
});

/**
 * An order as its page shows it, to anyone with its link: what was paid
 * for, what it cost, and where it goes. Null for a token no order has.
 */
export const byToken = query({
  args: { token: v.string() },
  returns: v.union(orderViewValidator, v.null()),
  handler: async (ctx, { token }) => {
    if (token.length !== TOKEN_LENGTH) return null;
    const order = await ctx.db
      .query("orders")
      .withIndex("by_token", (q) => q.eq("token", token))
      .unique();
    if (!order) return null;
    const pictures = await linePictures(ctx, order);
    return {
      name: orderName(order.number),
      test: order.test,
      paidAt: order.paidAt,
      language: order.language,
      lines: order.lines.map(({ proof: _, ...line }, index) => ({
        ...line,
        image: pictures[index]?.image ?? null,
        ...(pictures[index]?.proof && { proof: pictures[index].proof }),
      })),
      fees: order.fees,
      subtotal: order.subtotal,
      ...(order.delivery && { delivery: order.delivery }),
      discount: order.discount,
      total: order.total,
      ...(order.vat !== undefined && { vat: order.vat }),
      customer: { name: order.customer.name, email: order.customer.email },
      ...(order.address && { address: order.address }),
      ...(order.delivery?.key === "pickup" && { pickupAt: WORKSHOP_ADDRESS }),
    };
  },
});
