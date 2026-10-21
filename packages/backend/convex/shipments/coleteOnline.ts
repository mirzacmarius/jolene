import { env } from "../_generated/server";

/**
 * Colete Online's API, which books a courier for each parcel, the cheapest
 * it finds, and gives its AWB and label (ADR 0019). It signs in with OAuth's
 * client credentials; a test order books on its staging API, which no
 * courier collects from. Its errors go to the team in Romanian, as the
 * errors here are.
 */

const AUTH = "https://auth.colete-online.ro/token";
const API = "https://api.colete-online.ro/v1";

export interface ColeteOnline {
  clientId: string;
  clientSecret: string;
  /** The saved address the courier collects from; else the first saved. */
  addressId?: number;
}

/** Jolene's Colete Online account, or null until the deployment has one. */
export function coleteOnline(): ColeteOnline | null {
  const clientId = env.COLETE_ONLINE_CLIENT_ID?.trim();
  const clientSecret = env.COLETE_ONLINE_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret) return null;
  const addressId = Number(env.COLETE_ONLINE_ADDRESS_ID?.trim());
  return {
    clientId,
    clientSecret,
    ...(Number.isInteger(addressId) && addressId > 0 && { addressId }),
  };
}

/** What Colete Online said went wrong, or why it couldn't be asked. */
export class ColeteOnlineError extends Error {
  /** Colete Online may have booked it all the same, as on a timeout. */
  readonly unsure: boolean;

  constructor(message: string, unsure = false) {
    super(message);
    this.name = "ColeteOnlineError";
    this.unsure = unsure;
  }
}

/**
 * What a refusal says, from the shapes an API like this one answers in: a
 * message, else OAuth's description or code, and each field's errors.
 */
function said(body: unknown): string {
  if (typeof body !== "object" || body === null) return "";
  const record = body as Record<string, unknown>;
  const words = (part: unknown): part is string =>
    typeof part === "string" && !!part.trim();
  const summary = [record.message, record.error_description, record.error].find(
    words,
  );
  const errors = record.errors;
  const details =
    typeof errors === "object" && errors !== null
      ? Object.values(errors).flat()
      : [];
  return [summary, ...details]
    .filter(words)
    .map((part) => part.trim())
    .filter((part, index, parts) => parts.indexOf(part) === index)
    .join(" ");
}

async function reach(url: string, init: RequestInit): Promise<Response> {
  try {
    return await fetch(url, init);
  } catch (error) {
    throw new ColeteOnlineError(
      `Colete Online n-a răspuns (${String(error)})`,
      true,
    );
  }
}

/** What a failed call's answer says, if anything worth passing on. */
async function reason(response: Response): Promise<string> {
  const text = (await response.text()).trim();
  try {
    return said(JSON.parse(text));
  } catch {
    // Not JSON: a line of text is worth passing on, a page isn't.
    return text && !text.startsWith("<") && !text.includes("\n")
      ? text.slice(0, 200)
      : "";
  }
}

const refusedAccount = (why: string) =>
  new ColeteOnlineError(
    `Colete Online a refuzat contul: verificați COLETE_ONLINE_CLIENT_ID și COLETE_ONLINE_CLIENT_SECRET în Convex${why ? ` (${why})` : ""}`,
  );

/** Why a call failed, from its answer. */
async function failure(response: Response): Promise<ColeteOnlineError> {
  const why = await reason(response);
  if (response.status === 401 || response.status === 403)
    return refusedAccount(why);
  return new ColeteOnlineError(
    why
      ? `Colete Online a răspuns ${response.status}: ${why}`
      : `Colete Online a răspuns ${response.status}`,
    [502, 503, 504].includes(response.status),
  );
}

/** A token for the API, which lasts two hours: one for each booking. */
async function token(account: ColeteOnline): Promise<string> {
  const response = await reach(AUTH, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      client_id: account.clientId,
      client_secret: account.clientSecret,
      scope: "*",
    }).toString(),
  });
  // OAuth answers a client it doesn't know with 400 or 401.
  if (response.status === 400 || response.status === 401)
    throw refusedAccount(await reason(response));
  if (!response.ok) throw await failure(response);
  const { access_token: accessToken } = (await response.json()) as {
    access_token?: unknown;
  };
  if (typeof accessToken !== "string" || !accessToken)
    throw new ColeteOnlineError("Colete Online n-a dat niciun token");
  return accessToken;
}

/** Colete Online's API for an order: its staging API for a test order. */
export interface Session {
  token: string;
  test: boolean;
}

export async function signIn(
  account: ColeteOnline,
  test: boolean,
): Promise<Session> {
  return { token: await token(account), test };
}

async function call(
  session: Session,
  method: "GET" | "POST",
  path: string,
  { body, pdf = false }: { body?: unknown; pdf?: boolean } = {},
): Promise<Response> {
  const response = await reach(
    `${API}${session.test ? "/staging" : ""}/${path}`,
    {
      method,
      headers: {
        Authorization: `Bearer ${session.token}`,
        Accept: pdf ? "application/pdf" : "application/json",
        ...(body !== undefined && { "Content-Type": "application/json" }),
      },
      ...(body !== undefined && { body: JSON.stringify(body) }),
    },
  );
  if (!response.ok) throw await failure(response);
  return response;
}

const record = (value: unknown): Record<string, unknown> =>
  typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)
    : {};

const text = (value: unknown) =>
  typeof value === "string" || typeof value === "number" ? String(value) : "";

/** The first address saved in the account, which the courier collects from. */
export async function savedAddress(session: Session): Promise<number | null> {
  const body = record(await (await call(session, "GET", "address")).json());
  const [first] = Array.isArray(body.data) ? body.data : [];
  const id = Number(record(first).locationId);
  return Number.isInteger(id) && id > 0 ? id : null;
}

/** A parcel Colete Online booked. */
export interface Booked {
  id: string;
  awb: string;
  courier: string;
  service: string;
  /** VAT included, in bani. */
  price: number | null;
  pickupDate: string;
}

/** Books the courier for a parcel, as `order` describes it. */
export async function book(
  session: Session,
  order: Record<string, unknown>,
): Promise<Booked> {
  const body = record(
    await (await call(session, "POST", "order", { body: order })).json(),
  );
  const offer = record(body.service);
  const service = record(offer.service);
  const total = Number(record(offer.price).total);
  const booked = {
    id: text(body.uniqueId),
    awb: text(body.awb),
    courier: text(service.courierName),
    service: text(service.name),
    price: Number.isFinite(total) ? Math.round(total * 100) : null,
    pickupDate: text(body.estimatedPickupDate).slice(0, 10),
  };
  if (!booked.id)
    throw new ColeteOnlineError(
      "Colete Online n-a spus ce comandă a făcut: verificați în contul Colete Online",
      true,
    );
  return booked;
}

/** The AWB's label, to print, as a PDF. */
export async function label(session: Session, id: string): Promise<Blob> {
  const response = await call(
    session,
    "GET",
    `order/awb/${encodeURIComponent(id)}`,
    { pdf: true },
  );
  return new Blob([await response.arrayBuffer()], { type: "application/pdf" });
}

/** Where a parcel is, as its courier last said: null before it says. */
export interface Tracking {
  text: string;
  at: number;
  code?: number;
}

export async function tracking(
  session: Session,
  id: string,
): Promise<Tracking | null> {
  const body = record(
    await (
      await call(session, "GET", `order/status/${encodeURIComponent(id)}`)
    ).json(),
  );
  const history = (Array.isArray(body.history) ? body.history : []).map(
    (item: unknown) => {
      const entry = record(item);
      const seconds = Number(entry.unixDateTime);
      const code = Number(entry.code);
      return {
        text: text(record(record(entry.statusTextParts).ro).name).trim(),
        at: Number.isFinite(seconds) ? seconds * 1000 : 0,
        ...(Number.isInteger(code) && { code }),
      };
    },
  );
  const latest = history
    .filter((entry) => entry.text)
    .sort((a, b) => b.at - a.at)[0];
  return latest ?? null;
}
