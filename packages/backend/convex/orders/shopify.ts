import { digitalInvitation } from "@jolene/products/digital-invitation";

/**
 * Shopify's order webhooks: checking that a request came from the store, and
 * reading the lines of a paid order that concern Jolene's studio.
 */

/** The cart line attribute carrying the event a digital invitation is for. */
export const EVENT_ATTRIBUTE = digitalInvitation.eventAttribute;

/** The cart line attribute carrying a design's proof (ADR 0007). */
export const PROOF_ATTRIBUTE = "_proof";

/**
 * The SKU of the digital invitation's one variant, so a line carrying an
 * event is taken only when it's that product's.
 */
export const DIGITAL_INVITE_SKU = digitalInvitation.sku;

function base64(bytes: ArrayBuffer): string {
  let binary = "";
  for (const byte of new Uint8Array(bytes)) binary += String.fromCharCode(byte);
  return btoa(binary);
}

/** Compares two strings in time that doesn't depend on where they differ. */
function sameText(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let difference = 0;
  for (let i = 0; i < a.length; i++)
    difference |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return difference === 0;
}

/**
 * Whether a webhook's body was signed with the store's webhook secret: its
 * X-Shopify-Hmac-Sha256 header is the body's HMAC-SHA256, in base64.
 */
export async function signedByShopify(
  body: string,
  signature: string | null,
  secret: string,
): Promise<boolean> {
  if (!signature || !secret) return false;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const mac = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(body),
  );
  return sameText(base64(mac), signature.trim());
}

export interface PaidLine {
  sku: string | null;
  quantity: number;
  /** The event the line's digital invitation is for. */
  event: string | null;
  /** The proof the line is printed from. */
  proof: string | null;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/** A line attribute's value, from Shopify's list of name and value pairs. */
function property(properties: unknown, name: string): string | null {
  if (!Array.isArray(properties)) return null;
  for (const entry of properties)
    if (
      isRecord(entry) &&
      entry.name === name &&
      typeof entry.value === "string"
    )
      return entry.value;
  return null;
}

/**
 * The order's name and the lines that carry an event or a proof, from an
 * orders/paid webhook's body; null when it isn't an order.
 */
export function paidOrder(
  payload: unknown,
): { order: string; lines: PaidLine[] } | null {
  if (!isRecord(payload) || !Array.isArray(payload.line_items)) return null;
  const order =
    typeof payload.name === "string"
      ? payload.name
      : typeof payload.id === "number" || typeof payload.id === "string"
        ? String(payload.id)
        : null;
  if (!order) return null;
  const lines: PaidLine[] = [];
  for (const item of payload.line_items) {
    if (!isRecord(item)) continue;
    const event = property(item.properties, EVENT_ATTRIBUTE);
    const proof = property(item.properties, PROOF_ATTRIBUTE);
    if (!event && !proof) continue;
    lines.push({
      sku: typeof item.sku === "string" ? item.sku : null,
      quantity: typeof item.quantity === "number" ? item.quantity : 0,
      event,
      proof,
    });
  }
  return { order, lines };
}
