/**
 * A stand-in for Colete Online's API in tests: it signs the shop in, books
 * each parcel with the cheapest courier it pretends to find, prints each
 * AWB's label, says where each parcel is, and fails a call when a test
 * asks. Its staging API keeps its own bookings. Other hosts go to whatever
 * fetch was there before, such as the fake Stripe.
 */

/** The client credentials the fake signs in. */
export const coleteOnlineClient = {
  id: "colete-client",
  secret: "colete-secret",
};

/** Which call a request was: its token, the saved addresses, a booking, a label or a parcel's progress. */
export type Call = "token" | "address" | "order" | "awb" | "status";

export interface ColeteOnlineRequest {
  call: Call;
  method: string;
  /** Whether it went to the staging API. */
  staging: boolean;
  /** The booking a label or a progress was asked for. */
  id?: string;
  body: Record<string, unknown> | null;
  /** A token request's fields. */
  form: URLSearchParams | null;
  headers: Headers;
}

/** A parcel the fake booked, as it was sent. */
export interface Booking {
  uniqueId: string;
  awb: string;
  body: Record<string, unknown>;
  staging: boolean;
}

/** A change in a parcel's progress, as its courier said it. */
export interface Progress {
  name: string;
  /** When, in ms. */
  at: number;
  code?: number;
}

/**
 * How a call fails: Colete Online's answer, a page or a line of text in
 * its place, or no answer at all. A booking can go ahead before it fails.
 */
export type Failure =
  | { status: number; body?: unknown; text?: string; booked?: boolean }
  | "unreachable";

/** The workshop's address, the only one the account saved unless a test says. */
const workshop = {
  locationId: 4321,
  shortName: "Atelier Jolene",
  contact: { name: "Jolene Design SRL", phone: "0745000000" },
  address: {
    countryCode: "RO",
    city: "Iași",
    county: "Iași",
    street: "Str. Ion Creangă",
    number: "41",
    postalCode: "700317",
  },
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });

/** Replaces fetch with a Colete Online that keeps its bookings in memory. */
export function fakeColeteOnline() {
  const requests: ColeteOnlineRequest[] = [];
  const bookings = new Map<string, Booking>();
  const progress = new Map<string, Progress[]>();
  const failures = new Map<Call, Failure>();
  const tokens = new Set<string>();
  let addresses: unknown[] = [workshop];
  let offer = { id: 7, name: "Standard", courierName: "Cargus", total: 18.15 };

  /** Books a parcel, as Colete Online would before answering. */
  const keep = (body: Record<string, unknown>, staging: boolean): Booking => {
    const count = bookings.size + 1;
    const booking = {
      uniqueId: `${staging ? "ST" : "CO"}${String(count).padStart(6, "0")}`,
      awb: `${staging ? "9" : "1"}${String(count).padStart(9, "0")}`,
      body,
      staging,
    };
    bookings.set(booking.uniqueId, booking);
    return booking;
  };

  const failed = (failure: Exclude<Failure, "unreachable">) =>
    failure.text !== undefined
      ? new Response(failure.text, { status: failure.status })
      : json(failure.body ?? { message: "Server Error" }, failure.status);

  const previous = globalThis.fetch;
  globalThis.fetch = (async (
    input: string | URL | Request,
    init?: RequestInit,
  ) => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    const method = init?.method ?? "GET";
    const headers = new Headers(init?.headers);
    const raw = typeof init?.body === "string" ? init.body : null;

    if (url.hostname === "auth.colete-online.ro") {
      const form = new URLSearchParams(raw ?? "");
      requests.push({
        call: "token",
        method,
        staging: false,
        body: null,
        form,
        headers,
      });
      const failure = failures.get("token");
      if (failure === "unreachable") throw new TypeError("fetch failed");
      if (failure) return failed(failure);
      if (
        method !== "POST" ||
        url.pathname !== "/token" ||
        form.get("grant_type") !== "client_credentials" ||
        form.get("client_id") !== coleteOnlineClient.id ||
        form.get("client_secret") !== coleteOnlineClient.secret
      )
        return json(
          {
            error: "invalid_client",
            error_description: "Client authentication failed",
            message: "Client authentication failed",
          },
          401,
        );
      const token = `token-${tokens.size + 1}`;
      tokens.add(token);
      return json({
        token_type: "Bearer",
        expires_in: 7200,
        access_token: token,
      });
    }

    if (url.hostname !== "api.colete-online.ro") return previous(input, init);
    const staging = url.pathname.startsWith("/v1/staging/");
    const path = url.pathname.replace(/^\/v1\/(staging\/)?/, "");
    const [, call, id] =
      /^(address|order)$/.exec(path) ??
      /^order\/(awb|status)\/([^/]+)$/.exec(path) ??
      [];
    if (!call) return json({ message: `No such call: ${method} ${path}` }, 404);
    const body = raw ? (JSON.parse(raw) as Record<string, unknown>) : null;
    requests.push({
      call: call as Call,
      method,
      staging,
      ...(id && { id: decodeURIComponent(id) }),
      body,
      form: null,
      headers,
    });

    const failure = failures.get(call as Call);
    if (failure === "unreachable") throw new TypeError("fetch failed");
    if (failure) {
      // A gateway's timeout may come after Colete Online went ahead.
      if (failure.booked && call === "order" && body) keep(body, staging);
      return failed(failure);
    }
    const bearer = headers.get("authorization")?.replace(/^Bearer /, "");
    if (!bearer || !tokens.has(bearer))
      return json({ message: "Unauthenticated." }, 401);

    if (call === "address" && method === "GET")
      return json({
        data: addresses,
        pagination: { page: 1, perPage: 25, total: addresses.length },
      });
    if (call === "order" && method === "POST" && body) {
      const sender = body.sender as { addressId?: unknown } | undefined;
      const saved = addresses.some(
        (address) =>
          (address as { locationId?: unknown }).locationId ===
          sender?.addressId,
      );
      if (!saved)
        return json(
          {
            message: "The given data was invalid.",
            errors: { "sender.addressId": ["Adresa nu există."] },
          },
          422,
        );
      const booking = keep(body, staging);
      return json({
        uniqueId: booking.uniqueId,
        awb: booking.awb,
        estimatedPickupDate: "2026-10-23 10:00:00",
        service: {
          service: {
            id: offer.id,
            name: offer.name,
            courierName: offer.courierName,
          },
          price: {
            total: offer.total,
            noVat: Math.round((offer.total / 1.21) * 100) / 100,
          },
        },
      });
    }
    const booking = id ? bookings.get(decodeURIComponent(id)) : undefined;
    if (!booking || booking.staging !== staging)
      return json({ message: "Comanda nu există." }, 404);
    if (call === "awb" && method === "GET")
      return new Response(`%PDF-1.4 AWB ${booking.awb}`, {
        headers: { "content-type": "application/pdf" },
      });
    if (call === "status" && method === "GET")
      return json({
        summary: { awb: booking.awb },
        history: (progress.get(booking.uniqueId) ?? []).map((change) => ({
          unixDateTime: Math.floor(change.at / 1000),
          ...(change.code !== undefined && { code: change.code }),
          statusTextParts: {
            ro: { name: change.name },
            en: { name: change.name },
          },
        })),
      });
    return json({ message: `No such call: ${method} ${path}` }, 404);
  }) as typeof globalThis.fetch;

  return {
    requests,
    bookings,
    /** The calls of a kind, such as "order". */
    calls(call: Call) {
      return requests.filter((request) => request.call === call);
    },
    /** Fails each call of a kind the way `failure` says, until `recover`. */
    fail(call: Call, failure: Failure) {
      failures.set(call, failure);
    },
    recover(call: Call) {
      failures.delete(call);
    },
    /** Sets the addresses the account saved. */
    addresses(list: unknown[]) {
      addresses = list;
    },
    /** Sets the courier the next bookings find cheapest, at `total` lei. */
    offers(next: { name: string; courierName: string; total: number }) {
      offer = { ...offer, ...next };
    },
    /** Adds a change to a booked parcel's progress. */
    progress(uniqueId: string, change: Progress) {
      progress.set(uniqueId, [...(progress.get(uniqueId) ?? []), change]);
    },
    restore() {
      globalThis.fetch = previous;
    },
  };
}
