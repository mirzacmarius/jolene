import { Resend, vOnEmailEventArgs } from "@convex-dev/resend";
import { ConvexError } from "convex/values";
import { components, internal } from "./_generated/api";
import { env, internalMutation, type MutationCtx } from "./_generated/server";
import { errors } from "./utils/errors";

/**
 * The emails Jolene sends: sign-in codes, and couples' invitations to their
 * guests. They go through Resend's component, which queues, batches and
 * retries them; Resend's webhook (http.ts) reports which bounced.
 */

/** Emails can go out from this deployment. */
export function emailConfigured(): boolean {
  return Boolean(env.RESEND_API_KEY?.trim());
}

/** Who Jolene's emails come from: EMAIL_FROM, or salut@jolene.ro. */
export function sender(): { name: string; address: string } {
  const configured = env.EMAIL_FROM?.trim() || "Jolene <salut@jolene.ro>";
  const match = /^(.*)<([^>]+)>$/.exec(configured);
  return match
    ? {
        name: (match[1] as string).trim().replace(/^"|"$/g, "") || "Jolene",
        address: (match[2] as string).trim(),
      }
    : { name: "Jolene", address: configured };
}

/** "Name" <address>, with the name kept to what a header can hold. */
export function fromHeader(name: string, address: string): string {
  const safe = name.replace(/["<>\\\r\n]/g, "").trim();
  return safe ? `"${safe}" <${address}>` : address;
}

/** Read when sending, so a key set on the deployment applies at once. */
function mailer(): Resend {
  return new Resend(components.resend, {
    apiKey: env.RESEND_API_KEY?.trim() ?? "",
    webhookSecret: env.RESEND_WEBHOOK_SECRET?.trim() ?? "",
    // Real addresses, not only Resend's test ones.
    testMode: false,
    onEmailEvent: internal.emails.onEvent,
  });
}

export interface Email {
  to: string;
  from: string;
  subject: string;
  html: string;
  text: string;
  replyTo?: string[];
  /** The same key twice sends one email. */
  idempotencyKey?: string;
}

/** Queues an email; throws when this deployment can't send any. */
export async function sendEmail(ctx: MutationCtx, email: Email) {
  if (!emailConfigured()) throw new ConvexError(errors.emailUnavailable);
  return await mailer().sendEmail(ctx, email);
}

/** For Resend's webhook in http.ts. */
export async function handleResendWebhook(
  ctx: Parameters<Resend["handleResendEventWebhook"]>[0],
  request: Request,
) {
  return await mailer().handleResendEventWebhook(ctx, request);
}

/** Text for an HTML email, its special characters escaped. */
export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * An email's HTML around its content: one narrow column on paper white, in
 * the studio's colours, laid out as tables for every mail client.
 */
export function emailLayout(content: string, footer: string): string {
  return `<!doctype html><html><body style="margin:0;padding:0;background:#fbf8f3;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#fbf8f3;">
<tr><td align="center" style="padding:32px 16px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;font-family:Georgia,'Times New Roman',serif;color:#2b2622;">
${content}
<tr><td style="padding-top:32px;font-family:Helvetica,Arial,sans-serif;font-size:12px;line-height:18px;color:#8a8077;">${footer}</td></tr>
</table>
</td></tr>
</table>
</body></html>`;
}

/** The sign-in code as it reads best: "1234 5678". */
export function spacedCode(code: string): string {
  return code.length === 8 ? `${code.slice(0, 4)} ${code.slice(4)}` : code;
}

/**
 * A sign-in code's email, in Romanian and then English: the studio doesn't
 * know the visitor's language at this point.
 */
export function signInCodeEmail(code: string, minutes: number) {
  const spaced = spacedCode(code);
  const subject = `Codul de conectare Jolene · Your Jolene code: ${spaced}`;
  const text = [
    `Codul de conectare la Jolene este ${spaced}.`,
    `Scrieți-l în pagina deschisă; este valabil ${minutes} de minute. Dacă nu l-ați cerut, puteți ignora acest email.`,
    "",
    `Your Jolene code is ${spaced}.`,
    `Type it on the page you have open; it works for ${minutes} minutes. If you didn't ask for it, you can ignore this email.`,
  ].join("\n");
  const html = emailLayout(
    `<tr><td style="font-size:18px;line-height:28px;">Codul de conectare la Jolene este</td></tr>
<tr><td style="padding:16px 0;font-family:Helvetica,Arial,sans-serif;font-size:34px;letter-spacing:6px;font-weight:bold;">${spaced}</td></tr>
<tr><td style="font-family:Helvetica,Arial,sans-serif;font-size:14px;line-height:22px;color:#5c544d;">Scrieți-l în pagina deschisă; este valabil ${minutes} de minute. Dacă nu l-ați cerut, puteți ignora acest email.</td></tr>
<tr><td style="padding-top:24px;font-family:Helvetica,Arial,sans-serif;font-size:14px;line-height:22px;color:#5c544d;">Your Jolene code is <strong>${spaced}</strong>. Type it on the page you have open; it works for ${minutes} minutes. If you didn't ask for it, you can ignore this email.</td></tr>`,
    "Jolene · jolene.ro",
  );
  return { subject, text, html };
}

/** What a webhook event says of an email, for the couple's guest list. */
function statusOf(type: string) {
  switch (type) {
    case "email.sent":
      return "sent" as const;
    case "email.delivered":
      return "delivered" as const;
    case "email.bounced":
      return "bounced" as const;
    case "email.complained":
      return "complained" as const;
    case "email.failed":
      return "failed" as const;
    default:
      return null;
  }
}

/** Where a status stands: a later event never takes an email back. */
const rank = {
  queued: 0,
  sent: 1,
  delivered: 2,
  failed: 3,
  bounced: 3,
  complained: 3,
} as const;

/**
 * Keeps the guest list up to date with what Resend says of an invitation's
 * email: delivered, or bounced back and to be sent another way.
 */
export const onEvent = internalMutation({
  args: vOnEmailEventArgs,
  handler: async (ctx, { id, event }) => {
    const status = statusOf(event.type);
    if (!status) return;
    const email = await ctx.db
      .query("inviteEmails")
      .withIndex("by_emailId", (q) => q.eq("emailId", id))
      .unique();
    if (!email || rank[status] < rank[email.status]) return;
    const now = Date.now();
    await ctx.db.patch("inviteEmails", email._id, {
      status,
      updatedAt: now,
    });
    // The family's list entry shows their latest email.
    const latest = await ctx.db
      .query("inviteEmails")
      .withIndex("by_householdId", (q) =>
        q.eq("householdId", email.householdId),
      )
      .order("desc")
      .first();
    const household = await ctx.db.get("households", email.householdId);
    if (household && latest?._id === email._id)
      await ctx.db.patch("households", household._id, {
        emailed: { status, at: now },
      });
  },
});
