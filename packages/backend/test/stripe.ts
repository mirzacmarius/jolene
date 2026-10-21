/**
 * A stand-in for Stripe's API in tests: it answers the Stripe SDK's calls
 * for Checkout Sessions from memory, so a test can pay for one, or not.
 */

type Session = Record<string, unknown> & {
  id: string;
  client_reference_id: string | null;
  amount_subtotal: number;
};

/** What the SDK sent: the method, the path, and its form or query fields. */
export interface StripeRequest {
  method: string;
  path: string;
  fields: URLSearchParams;
  headers: Headers;
}

const shippingRate = {
  id: "shr_courier",
  object: "shipping_rate",
  display_name: "Curier, la adresă",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", "request-id": "req_test" },
  });

const notFound = (id: string) =>
  json(
    {
      error: {
        type: "invalid_request_error",
        code: "resource_missing",
        message: `No such checkout.session: '${id}'`,
      },
    },
    404,
  );

/** Replaces fetch with a Stripe that keeps Checkout Sessions in memory. */
export function fakeStripe() {
  const sessions = new Map<string, Session>();
  const requests: StripeRequest[] = [];

  /** A session as the API returns it, its delivery's rate expanded if asked. */
  const view = (session: Session, expand: string[]) => {
    const cost = session.shipping_cost as { shipping_rate: unknown } | null;
    return cost &&
      expand.some((path) => path.endsWith("shipping_cost.shipping_rate"))
      ? { ...session, shipping_cost: { ...cost, shipping_rate: shippingRate } }
      : session;
  };

  const create = (fields: URLSearchParams) => {
    const id = `cs_test_${crypto.randomUUID().replace(/-/g, "")}`;
    let subtotal = 0;
    for (let i = 0; fields.has(`line_items[${i}][quantity]`); i++)
      subtotal +=
        Number(fields.get(`line_items[${i}][quantity]`)) *
        Number(fields.get(`line_items[${i}][price_data][unit_amount]`));
    const session: Session = {
      id,
      object: "checkout.session",
      url: `https://checkout.stripe.com/c/pay/${id}`,
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
      customer_details: null,
      collected_information: null,
      shipping_cost: null,
      payment_intent: null,
    };
    sessions.set(id, session);
    return session;
  };

  // Bun's fetch is a getter, which spyOn can't wrap: swap it, and put it back.
  const realFetch = globalThis.fetch;
  globalThis.fetch = (async (
    input: string | URL | Request,
    init?: RequestInit,
  ) => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    const method = init?.method ?? "GET";
    const body = typeof init?.body === "string" ? init.body : "";
    const fields = new URLSearchParams(method === "GET" ? url.search : body);
    requests.push({
      method,
      path: url.pathname,
      fields,
      headers: new Headers(init?.headers),
    });
    if (url.hostname !== "api.stripe.com")
      return new Response(null, { status: 404 });
    // The SDK numbers a list's items: expand[0]=…
    const expand = [...fields]
      .filter(([key]) => /^expand\[\d*\]$/.test(key))
      .map(([, value]) => value);
    const one = /^\/v1\/checkout\/sessions\/([^/]+)$/.exec(url.pathname);
    if (url.pathname === "/v1/checkout/sessions" && method === "POST")
      return json(create(fields));
    if (url.pathname === "/v1/checkout/sessions" && method === "GET") {
      const since = Number(fields.get("created[gte]") ?? 0);
      const status = fields.get("status");
      const data = [...sessions.values()]
        .filter(
          (session) =>
            (session.created as number) >= since &&
            (!status || session.status === status),
        )
        .reverse()
        .map((session) => view(session, expand));
      return json({
        object: "list",
        url: "/v1/checkout/sessions",
        has_more: false,
        data,
      });
    }
    if (one?.[1] && method === "GET") {
      const session = sessions.get(one[1]);
      return session ? json(view(session, expand)) : notFound(one[1]);
    }
    return json({ error: { type: "invalid_request_error" } }, 400);
  }) as typeof globalThis.fetch;

  return {
    sessions,
    requests,
    /** The session the latest checkout opened. */
    latest() {
      const session = [...sessions.values()].at(-1);
      if (!session) throw new Error("No Checkout Session yet");
      return session;
    },
    /**
     * Pays for a session as Stripe's page would: the couple's details, a
     * courier to Cluj, and a promotion code's discount if any.
     */
    pay(id: string, { discount = 0, delivery = 2000 } = {}) {
      const session = sessions.get(id);
      if (!session) throw new Error(`No Checkout Session ${id}`);
      Object.assign(session, {
        status: "complete",
        payment_status: "paid",
        customer_details: {
          name: "ANA POPESCU",
          email: "ana@example.com",
          phone: "+40712345678",
        },
        collected_information: {
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
        shipping_cost: {
          amount_total: delivery,
          shipping_rate: shippingRate.id,
        },
        total_details: {
          amount_discount: discount,
          amount_shipping: delivery,
          amount_tax: 0,
        },
        amount_total: session.amount_subtotal - discount + delivery,
        payment_intent: `pi_${id.slice(8, 20)}`,
      });
      return session;
    },
    restore() {
      globalThis.fetch = realFetch;
    },
  };
}
