import { api } from "@jolene/backend/convex/_generated/api";
import { MOST_PICKS, PICK_LENGTH } from "@jolene/backend/convex/designs/finishes";
import { fetchMutation } from "convex/nextjs";
import { ConvexError } from "convex/values";

import { cartToken } from "@/lib/cart/server";

interface ProofLine {
  answers: Array<{ key: string; value: string }>;
  options: Array<{ name: string; value: string }>;
  proofId: string;
  quantity: number;
}

const isText = (text: unknown): text is string =>
  typeof text === "string" && text.length > 0 && text.length <= PICK_LENGTH;

// Each pair as the studio keeps a pick: a paper's name or an order option's key, and its value.
function readPairs<K extends "key" | "name">(list: unknown, key: K) {
  if (!Array.isArray(list) || list.length > MOST_PICKS) return null;
  const pairs: Array<Record<K | "value", string>> = [];
  for (const item of list as unknown[]) {
    if (typeof item !== "object" || item === null) return null;
    const pair = item as Record<string, unknown>;
    const name = pair[key];
    const value = pair.value;
    if (!isText(name) || !isText(value)) return null;
    pairs.push({ [key]: name, value } as Record<K | "value", string>);
  }
  return pairs;
}

function readLine(body: unknown): ProofLine | null {
  if (typeof body !== "object" || body === null) return null;
  const { answers, options, proofId, quantity } = body as Record<string, unknown>;
  const picked = readPairs(options, "name");
  const answered = readPairs(answers, "key");
  if (!picked || !answered || !isText(proofId) || typeof quantity !== "number") return null;
  return { answers: answered, options: picked, proofId, quantity };
}

// The studio, on this same address, puts a design its couple approved in their cart, with the finishes they picked
// (ADR 0021). A page elsewhere can't: a JSON body sent from another origin needs CORS, which this doesn't answer.
export async function POST(request: Request): Promise<Response> {
  const site = request.headers.get("sec-fetch-site") ?? "same-origin";
  const json = request.headers.get("content-type")?.startsWith("application/json") ?? false;
  if (site !== "same-origin" || !json) return new Response(null, { status: 403 });
  const line = readLine(await request.json().catch(() => null));
  if (!line) return new Response(null, { status: 400 });
  const token = await cartToken();
  try {
    await fetchMutation(api.cart.addProof, { ...line, token });
  } catch (error) {
    // The cart's reason, for the studio to tell the couple in their language.
    if (error instanceof ConvexError && typeof error.data === "string")
      return Response.json({ error: error.data }, { status: 422 });
    return new Response(null, { status: 502 });
  }
  return new Response(null, { status: 204 });
}
