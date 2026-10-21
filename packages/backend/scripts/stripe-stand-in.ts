/**
 * A stand-in for Stripe, to try the shop's checkout on a local Convex backend
 * without a Stripe account or a way out to Stripe. It answers the calls
 * Convex makes for Checkout Sessions and Stripe Tax's settings, and serves a
 * page that pays for a session, then sends the couple back to the shop and,
 * given the webhook's secret, Stripe's signed event to Convex.
 *
 *   bun scripts/stripe-stand-in.ts
 *
 * with, on the local deployment:
 *
 *   npx convex env set STRIPE_SECRET_KEY sk_test_stand_in
 *   npx convex env set STRIPE_API_URL http://127.0.0.1:12111
 *   npx convex env set STRIPE_WEBHOOK_SECRET whsec_stand_in   # optional
 *
 * Set STRIPE_WEBHOOK_URL and STRIPE_WEBHOOK_SECRET here too for the webhook,
 * such as http://127.0.0.1:3211/stripe-webhook. Only a Convex backend on
 * this computer can reach it. STRIPE_TAX=on here answers as an account with
 * Stripe Tax set up and registered in Romania.
 */
import { createHmac, randomUUID } from "node:crypto";

const port = Number(process.env.PORT ?? 12111);
const webhookUrl = process.env.STRIPE_WEBHOOK_URL ?? "";
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET ?? "";
const taxSetUp = Boolean(process.env.STRIPE_TAX);
const base = `http://127.0.0.1:${port}`;

/** Romania's standard VAT, inside a price that includes it. */
const romanianVat = (amount: number) => Math.round((amount * 21) / 121);

interface Item {
  name: string;
  description: string | null;
  quantity: number;
  unit: number;
}

type Session = Record<string, unknown> & {
  id: string;
  created: number;
  status: string;
  amount_subtotal: number;
  success_url: string;
  cancel_url: string;
  items: Item[];
  delivery: { name: string; amount: number } | null;
  automatic_tax: { enabled: boolean; status: string | null };
};

const sessions = new Map<string, Session>();

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json",
      "request-id": "req_stand_in",
    },
  });

const failure = (status: number, message: string, code?: string) =>
  json({ error: { type: "invalid_request_error", message, code } }, status);

const html = (text: string) =>
  text.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

const lei = (bani: number) =>
  `${(bani / 100).toFixed(2).replace(".", ",")} lei`;

/** A session as Stripe's API returns it, with its delivery's rate if asked. */
function view(session: Session, expand: string[]) {
  const { items: _, delivery, ...api } = session;
  const cost = api.shipping_cost as { amount_total: number } | null;
  return cost &&
    delivery &&
    expand.some((path) => path.endsWith("shipping_cost.shipping_rate"))
    ? {
        ...api,
        shipping_cost: {
          ...cost,
          shipping_rate: {
            id: "shr_stand_in",
            object: "shipping_rate",
            display_name: delivery.name,
          },
        },
      }
    : api;
}

function create(fields: URLSearchParams): Session {
  const id = `cs_test_${randomUUID().replace(/-/g, "")}`;
  const items: Item[] = [];
  for (let i = 0; fields.has(`line_items[${i}][quantity]`); i++) {
    const data = `line_items[${i}][price_data]`;
    items.push({
      name: fields.get(`${data}[product_data][name]`) ?? "",
      description: fields.get(`${data}[product_data][description]`),
      quantity: Number(fields.get(`line_items[${i}][quantity]`)),
      unit: Number(fields.get(`${data}[unit_amount]`)),
    });
  }
  const rate = "shipping_options[0][shipping_rate_data]";
  const subtotal = items.reduce((sum, i) => sum + i.quantity * i.unit, 0);
  const automaticTax = fields.get("automatic_tax[enabled]") === "true";
  const session: Session = {
    id,
    object: "checkout.session",
    url: `${base}/pay/${id}`,
    status: "open",
    payment_status: "unpaid",
    client_reference_id: fields.get("client_reference_id"),
    locale: fields.get("locale"),
    livemode: false,
    created: Math.floor(Date.now() / 1000),
    currency: "ron",
    amount_subtotal: subtotal,
    amount_total: subtotal,
    total_details: { amount_discount: 0, amount_shipping: 0, amount_tax: 0 },
    automatic_tax: {
      enabled: automaticTax,
      status: automaticTax ? "requires_location_inputs" : null,
    },
    customer_details: null,
    collected_information: null,
    shipping_cost: null,
    payment_intent: null,
    success_url: fields.get("success_url") ?? base,
    cancel_url: fields.get("cancel_url") ?? base,
    items,
    delivery: fields.has(`${rate}[display_name]`)
      ? {
          name: fields.get(`${rate}[display_name]`) ?? "",
          amount: Number(fields.get(`${rate}[fixed_amount][amount]`)),
        }
      : null,
  };
  sessions.set(id, session);
  return session;
}

/** What a session's couple pays, delivery included. */
const totalOf = (session: Session) =>
  session.amount_subtotal + (session.delivery?.amount ?? 0);

/** Pays for a session as a couple in Cluj would on Stripe's page. */
function pay(session: Session) {
  const delivery = session.delivery?.amount ?? 0;
  const tax = session.automatic_tax.enabled;
  Object.assign(session, {
    status: "complete",
    payment_status: "paid",
    customer_details: {
      name: "ANA POPESCU",
      email: "ana@example.com",
      phone: "+40712345678",
    },
    collected_information: session.delivery && {
      shipping_details: {
        name: "Ana Popescu",
        address: {
          line1: "Strada Florilor 1",
          line2: "Ap. 2",
          city: "Cluj-Napoca",
          state: "Cluj",
          postal_code: "400000",
          country: "RO",
        },
      },
    },
    shipping_cost: session.delivery && {
      amount_total: delivery,
      shipping_rate: "shr_stand_in",
    },
    total_details: {
      amount_discount: 0,
      amount_shipping: delivery,
      amount_tax: tax ? romanianVat(totalOf(session)) : 0,
    },
    automatic_tax: { enabled: tax, status: tax ? "complete" : null },
    amount_total: totalOf(session),
    payment_intent: `pi_${session.id.slice(8, 32)}`,
  });
}

/** Stripe's signed event that the session completed, to Convex's webhook. */
async function notify(session: Session) {
  if (!webhookUrl || !webhookSecret) return;
  const payload = JSON.stringify({
    id: `evt_${randomUUID().replace(/-/g, "")}`,
    object: "event",
    type: "checkout.session.completed",
    created: Math.floor(Date.now() / 1000),
    livemode: false,
    data: { object: view(session, []) },
  });
  const time = Math.floor(Date.now() / 1000);
  const signature = createHmac("sha256", webhookSecret)
    .update(`${time}.${payload}`)
    .digest("hex");
  const response = await fetch(webhookUrl, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "stripe-signature": `t=${time},v1=${signature}`,
    },
    body: payload,
  });
  console.log(`Webhook for ${session.id}: ${response.status}`);
}

function page(session: Session) {
  const rows = [
    ...session.items.map(
      (item) =>
        `<li>${item.quantity} × ${html(item.name)}${item.description ? `<br><small>${html(item.description)}</small>` : ""}<span>${lei(item.quantity * item.unit)}</span></li>`,
    ),
    ...(session.delivery
      ? [
          `<li>${html(session.delivery.name)}<span>${lei(session.delivery.amount)}</span></li>`,
        ]
      : []),
  ];
  const total = totalOf(session);
  const vat = session.automatic_tax.enabled
    ? `<br><small>Din care TVA: ${lei(romanianVat(total))}</small>`
    : "";
  return `<!doctype html><html lang="ro"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width">
<title>Stripe stand-in</title><style>body{font-family:system-ui,sans-serif;max-width:32rem;margin:3rem auto;padding:0 1rem;color:#222}
li{display:flex;justify-content:space-between;gap:1rem;margin:.75rem 0}ul{padding:0;list-style:none}small{color:#666}
button{font-size:1rem;padding:.75rem 1.5rem;border:0;border-radius:.5rem;background:#635bff;color:#fff;cursor:pointer}</style></head>
<body><h1>Stripe stand-in</h1><p><small>Test mode: nothing is charged.</small></p><ul>${rows.join("")}</ul>
<p><strong>Total: ${lei(total)}</strong>${vat}</p><form method="post"><button>Plătește</button></form>
<p><a href="${html(session.cancel_url)}">Înapoi la coș</a></p></body></html>`;
}

Bun.serve({
  port,
  hostname: "127.0.0.1",
  async fetch(request) {
    const url = new URL(request.url);
    const { method } = request;
    const fields = new URLSearchParams(
      method === "GET" ? url.search : await request.text(),
    );
    // The SDK numbers a list's items: expand[0]=…
    const expand = [...fields]
      .filter(([key]) => /^expand\[\d*\]$/.test(key))
      .map(([, value]) => value);

    if (url.pathname.startsWith("/v1/")) {
      if (!request.headers.get("authorization")?.startsWith("Bearer sk_test_"))
        return failure(401, "Invalid API Key provided");
      if (url.pathname === "/v1/tax/settings" && method === "GET")
        return json({
          object: "tax.settings",
          defaults: {
            tax_code: taxSetUp ? "txcd_99999999" : null,
            tax_behavior: null,
          },
          head_office: taxSetUp
            ? { address: { city: "Iași", country: "RO" } }
            : null,
          livemode: false,
          status: taxSetUp ? "active" : "pending",
        });
      if (url.pathname === "/v1/checkout/sessions" && method === "POST")
        return json(view(create(fields), expand));
      if (url.pathname === "/v1/checkout/sessions" && method === "GET") {
        const since = Number(fields.get("created[gte]") ?? 0);
        const status = fields.get("status");
        const data = [...sessions.values()]
          .filter((s) => s.created >= since && (!status || s.status === status))
          .reverse()
          .map((s) => view(s, expand));
        return json({
          object: "list",
          url: "/v1/checkout/sessions",
          has_more: false,
          data,
        });
      }
      const id = /^\/v1\/checkout\/sessions\/([^/]+)$/.exec(url.pathname)?.[1];
      const session = id && sessions.get(id);
      if (session && method === "GET") return json(view(session, expand));
      return failure(
        404,
        `No such checkout.session: '${id}'`,
        "resource_missing",
      );
    }

    const id = /^\/pay\/([^/]+)$/.exec(url.pathname)?.[1];
    const session = id && sessions.get(id);
    if (!session) return new Response("Not found", { status: 404 });
    if (method === "GET")
      return new Response(page(session), {
        headers: { "content-type": "text/html; charset=utf-8" },
      });
    if (session.status === "open") {
      pay(session);
      await notify(session);
    }
    return Response.redirect(
      session.success_url.replace("{CHECKOUT_SESSION_ID}", session.id),
      303,
    );
  },
});

console.log(`Stripe stand-in on ${base}`);
