import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import {
  type ActionCtx,
  env,
  internalAction,
  internalMutation,
  type MutationCtx,
  mutation,
} from "./_generated/server";
import {
  emailConfigured,
  emailLayout,
  fromHeader,
  sendEmail,
  sender,
} from "./emails";
import {
  invoiceOf,
  ManualInvoice,
  romanianDay,
  standardTax,
} from "./invoices/document";
import {
  createInvoice,
  type Issued,
  invoicePdf,
  invoiceTotal,
  reverseInvoice,
  type SmartBill,
  SmartBillError,
  smartBill,
  taxes,
} from "./invoices/smartbill";
import { invoiceEmail, invoiceNotice } from "./orders/emails";
import { lei, orderName } from "./orders/format";
import { invoiceUrl, orderUrl, shopUrl } from "./orders/links";
import type { Invoice } from "./orders/validators";
import schema from "./schema";
import { requireWorkshop } from "./workshop/staff";

/**
 * An order's invoice, which SmartBill issues as soon as the order is paid
 * and sends to e-Factura, and the credit note that reverses it when the
 * order is refunded (ADR 0018). A test order's invoice is only a draft.
 */

const documentValidator = v.union(
  v.literal("invoice"),
  v.literal("creditNote"),
);
type Document = "invoice" | "creditNote";

/** The order's field for an invoice or a credit note, set to `value`. */
const field = (document: Document, value: Invoice) =>
  document === "invoice" ? { invoice: value } : { creditNote: value };

/** "JOL 0042": how an invoice is named, by its series and number. */
export const invoiceName = ({ series, number }: Issued) =>
  `${series} ${number}`.trim();

const said = (error: unknown) =>
  error instanceof Error ? error.message : String(error);

/** Why it wasn't issued, as the team reads it. */
function refusal(error: unknown): string {
  return error instanceof SmartBillError && error.unsure
    ? `${error.message}. SmartBill poate s-o fi emis totuși: verificați în SmartBill înainte s-o emiteți din nou.`
    : said(error);
}

/** Tells the team, or the logs while no email can go out. */
async function tellTeam(
  ctx: MutationCtx,
  order: Doc<"orders">,
  notice: Parameters<typeof invoiceNotice>[1],
) {
  const shop = shopUrl();
  const email = invoiceNotice(
    order,
    notice,
    shop && orderUrl(shop, order.token),
  );
  if (!emailConfigured()) {
    console.warn(email.text);
    return;
  }
  const { name, address } = sender();
  await sendEmail(ctx, {
    to: env.ORDERS_EMAIL?.trim() || address,
    from: fromHeader(name, address),
    subject: email.subject,
    text: email.text,
    html: emailLayout(email.html, email.footer),
  });
}

/**
 * Takes an order's invoice or credit note in hand, unless it's already
 * issued or being issued. Returns the order, or null to leave it be.
 */
export const claim = internalMutation({
  args: { orderId: v.id("orders"), document: documentValidator },
  returns: v.union(schema.doc("orders"), v.null()),
  handler: async (ctx, { orderId, document }) => {
    const order = await ctx.db.get("orders", orderId);
    if (!order) return null;
    const status = order[document]?.status;
    if (status === "issued" || status === "issuing") return null;
    // A credit note reverses an issued invoice, and nothing else.
    if (document === "creditNote" && order.invoice?.status !== "issued")
      return null;
    await ctx.db.patch(
      "orders",
      orderId,
      field(document, { status: "issuing", at: Date.now() }),
    );
    return order;
  },
});

/** Records that SmartBill issued it: from now on nothing issues it again. */
export const issued = internalMutation({
  args: {
    orderId: v.id("orders"),
    document: documentValidator,
    series: v.string(),
    number: v.string(),
    draft: v.boolean(),
  },
  returns: v.null(),
  handler: async (ctx, { orderId, document, series, number, draft }) => {
    await ctx.db.patch(
      "orders",
      orderId,
      field(document, {
        status: "issued",
        at: Date.now(),
        ...(series && { series }),
        ...(number && { number }),
        ...(draft && { draft }),
      }),
    );
    return null;
  },
});

/** Records that SmartBill refused it, and tells the team. */
export const refused = internalMutation({
  args: {
    orderId: v.id("orders"),
    document: documentValidator,
    error: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, { orderId, document, error }) => {
    const order = await ctx.db.get("orders", orderId);
    if (!order) return null;
    await ctx.db.patch(
      "orders",
      orderId,
      field(document, { status: "failed", at: Date.now(), error }),
    );
    console.warn(
      `Order ${orderName(order.number)}'s ${document} wasn't issued: ${error}`,
    );
    await tellTeam(ctx, order, { document, problem: error });
    return null;
  },
});

/**
 * Keeps the PDF of an issued invoice or credit note, notes what went wrong
 * once it was issued, and sends the couple their invoice.
 */
export const finished = internalMutation({
  args: {
    orderId: v.id("orders"),
    document: documentValidator,
    file: v.optional(v.id("_storage")),
    warning: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, { orderId, document, file, warning }) => {
    const order = await ctx.db.get("orders", orderId);
    const done = order?.[document];
    if (!order || done?.status !== "issued") return null;
    await ctx.db.patch(
      "orders",
      orderId,
      field(document, {
        ...done,
        ...(file && { file }),
        ...(warning && { warning }),
      }),
    );
    const name = invoiceName({
      series: done.series ?? "",
      number: done.number ?? "",
    });
    if (warning) {
      console.warn(
        `Order ${orderName(order.number)}'s ${document} ${name}: ${warning}`,
      );
      await tellTeam(ctx, order, { document, issued: name, problem: warning });
    }
    const shop = shopUrl();
    if (document !== "invoice" || !file || !order.customer.email || !shop)
      return null;
    if (!emailConfigured()) {
      console.log(
        `Order ${orderName(order.number)}'s invoice ${name} went by no email: RESEND_API_KEY isn't set`,
      );
      return null;
    }
    const email = invoiceEmail(
      order,
      name,
      invoiceUrl(shop, order.token),
      orderUrl(shop, order.token),
    );
    const { name: from, address } = sender();
    await sendEmail(ctx, {
      to: order.customer.email,
      from: fromHeader(from, address),
      subject: email.subject,
      text: email.text,
      html: emailLayout(email.html, email.footer),
      replyTo: [env.ORDERS_EMAIL?.trim() || address],
      idempotencyKey: `order-${order._id}-invoice`,
    });
    return null;
  },
});

/**
 * After SmartBill issued it: keeps its PDF and checks it comes to what
 * Stripe charged. Nothing here issues it again, whatever fails.
 */
async function finish(
  ctx: ActionCtx,
  account: SmartBill,
  order: Doc<"orders">,
  document: Document,
  done: Issued,
) {
  const warnings: string[] = [];
  let file: Id<"_storage"> | undefined;
  try {
    file = await ctx.storage.store(await invoicePdf(account, done));
  } catch (error) {
    warnings.push(`PDF-ul n-a putut fi luat din SmartBill (${said(error)}).`);
  }
  if (document === "invoice")
    try {
      const total = await invoiceTotal(account, done);
      if (total !== null && total !== order.total)
        warnings.push(
          `în SmartBill are ${lei(total)}, iar Stripe a încasat ${lei(order.total)}: verificați-o.`,
        );
    } catch {
      // Only a check: the invoice stands without it.
    }
  await ctx.runMutation(internal.invoices.finished, {
    orderId: order._id,
    document,
    ...(file && { file }),
    ...(warnings.length && { warning: warnings.join(" ") }),
  });
}

/**
 * Issues a paid order's invoice in SmartBill, once, and sends the couple its
 * PDF: what orders.record schedules. A test order's is a draft.
 */
export const issue = internalAction({
  args: { orderId: v.id("orders") },
  returns: v.null(),
  handler: async (ctx, { orderId }) => {
    const account = smartBill();
    if (!account) return null;
    const order: Doc<"orders"> | null = await ctx.runMutation(
      internal.invoices.claim,
      { orderId, document: "invoice" },
    );
    if (!order) return null;
    let done: Issued;
    try {
      const tax = standardTax(await taxes(account));
      if (!tax)
        throw new ManualInvoice("SmartBill n-are nicio cotă de TVA a firmei.");
      done = await createInvoice(
        account,
        invoiceOf(order, account, tax, romanianDay(Date.now())),
      );
    } catch (error) {
      await ctx.runMutation(internal.invoices.refused, {
        orderId,
        document: "invoice",
        error: refusal(error),
      });
      return null;
    }
    await ctx.runMutation(internal.invoices.issued, {
      orderId,
      document: "invoice",
      ...done,
      draft: order.test,
    });
    // A draft has no number to print or check.
    if (!order.test) await finish(ctx, account, order, "invoice", done);
    return null;
  },
});

/**
 * Reverses a refunded order's invoice in full with a credit note, which
 * SmartBill issues in the invoice's series. For the workshop's refunds to
 * call; false when there's no issued invoice, or it's already reversed.
 */
export async function creditInvoice(
  ctx: MutationCtx,
  orderId: Id<"orders">,
): Promise<boolean> {
  const order = await ctx.db.get("orders", orderId);
  const invoice = order?.invoice;
  if (
    !order ||
    invoice?.status !== "issued" ||
    invoice.draft ||
    !invoice.series ||
    !invoice.number ||
    (order.creditNote && order.creditNote.status !== "failed")
  )
    return false;
  await ctx.scheduler.runAfter(0, internal.invoices.reverse, { orderId });
  return true;
}

/** Issues the credit note creditInvoice asked for. */
export const reverse = internalAction({
  args: { orderId: v.id("orders") },
  returns: v.null(),
  handler: async (ctx, { orderId }) => {
    const order: Doc<"orders"> | null = await ctx.runMutation(
      internal.invoices.claim,
      { orderId, document: "creditNote" },
    );
    const invoice = order?.invoice;
    if (!order || !invoice?.series || !invoice.number) return null;
    const account = smartBill();
    let done: Issued;
    try {
      if (!account)
        throw new ManualInvoice(
          "SmartBill nu mai e configurat: stornați factura de mână.",
        );
      done = await reverseInvoice(
        account,
        { series: invoice.series, number: invoice.number },
        romanianDay(Date.now()),
      );
    } catch (error) {
      await ctx.runMutation(internal.invoices.refused, {
        orderId,
        document: "creditNote",
        error: refusal(error),
      });
      return null;
    }
    await ctx.runMutation(internal.invoices.issued, {
      orderId,
      document: "creditNote",
      ...done,
      draft: false,
    });
    await finish(ctx, account, order, "creditNote", done);
    return null;
  },
});

/** How long an invoice may stay "issuing" before it's taken as stuck. */
const STUCK = 15 * 60_000;

/**
 * Asks SmartBill for an order's invoice again, for the workshop: after it
 * refused one, for an order paid before SmartBill was set up, or for one
 * stuck being issued, which SmartBill may have issued all the same: the
 * team looks in SmartBill first.
 */
export const retry = mutation({
  args: { number: v.number() },
  returns: v.boolean(),
  handler: async (ctx, { number }) => {
    await requireWorkshop(ctx);
    const order = await ctx.db
      .query("orders")
      .withIndex("by_number", (q) => q.eq("number", number))
      .unique();
    if (!order || !smartBill()) return false;
    const { invoice } = order;
    if (
      invoice?.status === "issued" ||
      (invoice?.status === "issuing" && Date.now() - invoice.at < STUCK)
    )
      return false;
    await ctx.db.patch("orders", order._id, { invoice: undefined });
    await ctx.scheduler.runAfter(0, internal.invoices.issue, {
      orderId: order._id,
    });
    return true;
  },
});
