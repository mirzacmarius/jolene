import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { EUCALYPTUS_ASSET, eucaliptInvitation } from "@jolene/design";
import { attributes, proofNote } from "@jolene/products/order";
import { Glob } from "bun";
import { convexTest } from "convex-test";
import { api, internal } from "./_generated/api";
import schema from "./schema";

// convex-test loads the functions from this map, as Vite's import.meta.glob
// would build it.
const modules = Object.fromEntries(
  [...new Glob("**/*.ts").scanSync(import.meta.dir)]
    .filter((path) => !path.endsWith(".test.ts"))
    .map((path) => [`./${path}`, () => import(`./${path}`)]),
);

const sample = {
  suite: {
    slug: "sample",
    name: { ro: "Eucalipt", en: "Eucalyptus" },
    description: { ro: "Ramuri de eucalipt.", en: "Eucalyptus sprigs." },
    occasion: "wedding" as const,
    styles: ["botanic"],
    published: true,
    sortOrder: 0,
    sampleFields: {},
  },
  templates: [
    {
      slug: "sample-invitation",
      document: eucaliptInvitation,
      shopifyProductHandle: "invitatie-eucalipt",
    },
  ],
  art: [],
};

const store = {
  SHOPIFY_STORE_DOMAIN: "https://jolene.myshopify.com/",
  SHOPIFY_CLIENT_ID: "client",
  SHOPIFY_CLIENT_SECRET: "secret",
};

const google = {
  AUTH_GOOGLE_ID: "client.apps.googleusercontent.com",
  AUTH_GOOGLE_SECRET: "secret",
  SITE_URL: "https://jolene-studio.vercel.app/studio/",
};

const realFetch = globalThis.fetch;

beforeEach(() => {
  process.env.WORKSHOP_EMAILS = " Atelier@Jolene.ro, marius@example.com";
});

// The functions read the environment through the same process.env object.
afterEach(() => {
  globalThis.fetch = realFetch;
  for (const key of [
    "WORKSHOP_EMAILS",
    ...Object.keys(google),
    ...Object.keys(store),
  ])
    delete process.env[key];
});

async function setUp() {
  const t = convexTest(schema, modules);
  await t.mutation(internal.catalog.save.suite, sample);
  const signIn = async (user: {
    email?: string;
    emailVerificationTime?: number;
  }) => {
    const userId = await t.run((ctx) => ctx.db.insert("users", user));
    // Convex Auth's subject is the user id and the session id.
    return t.withIdentity({ subject: `${userId}|session` });
  };
  return {
    t,
    couple: await signIn({}),
    workshop: await signIn({
      email: "atelier@jolene.ro",
      emailVerificationTime: 1,
    }),
    signIn,
  };
}

/** A paid order of a designed invitation, as the Admin API answers it. */
function storeOrder(proofId: string) {
  const money = (amount: string) => ({
    shopMoney: { amount, currencyCode: "RON" },
  });
  return {
    id: "gid://shopify/Order/7",
    legacyResourceId: "7",
    name: "#1001",
    processedAt: "2026-10-20T10:00:00Z",
    test: false,
    note: "Livrare până pe 1 noiembrie",
    displayFinancialStatus: "PAID",
    displayFulfillmentStatus: "UNFULFILLED",
    lineItems: {
      nodes: [
        {
          id: "gid://shopify/LineItem/1",
          title: "Invitație Eucalipt",
          variantTitle: "Default Title",
          currentQuantity: 60,
          customAttributes: [
            { key: "Culoare sigiliu", value: "Auriu" },
            { key: proofNote, value: "aprobat pe 20 octombrie 2026" },
            { key: attributes.proof, value: proofId },
            {
              key: attributes.extras,
              value: "gid://shopify/ProductVariant/525",
            },
            { key: attributes.line, value: "q1" },
          ],
          originalUnitPriceSet: money("8.00"),
          variant: { id: "gid://shopify/ProductVariant/1" },
          product: { id: "gid://shopify/Product/1" },
        },
        {
          id: "gid://shopify/LineItem/2",
          title: "Opțiuni suplimentare",
          variantTitle: "2,50 lei",
          currentQuantity: 60,
          customAttributes: [{ key: attributes.extrasFor, value: "q1" }],
          originalUnitPriceSet: money("2.50"),
          variant: { id: "gid://shopify/ProductVariant/525" },
          product: { id: "gid://shopify/Product/9" },
        },
      ],
      pageInfo: { hasNextPage: false, endCursor: null },
    },
  };
}

/** What the store has of the order's products, by ID. */
const nodes: Record<string, unknown> = {
  "gid://shopify/Product/1": {
    id: "gid://shopify/Product/1",
    lineOptions: { value: '["gid://shopify/Metaobject/11"]' },
    minQuantity: { value: "50" },
  },
  "gid://shopify/Metaobject/11": {
    id: "gid://shopify/Metaobject/11",
    fields: [
      { key: "label", value: "Culoare sigiliu" },
      { key: "kind", value: "select" },
      { key: "required", value: "true" },
      { key: "choices", value: '["gid://shopify/Metaobject/21"]' },
    ],
  },
  "gid://shopify/Metaobject/21": {
    id: "gid://shopify/Metaobject/21",
    fields: [
      { key: "label", value: "Auriu" },
      { key: "price", value: "2.50" },
    ],
  },
};

/** Answers the workshop's calls as the store would, and keeps them. */
function fakeStore(order: unknown, token = { access_token: "shpat_test" }) {
  const calls: { url: string; token?: string | null; query?: string }[] = [];
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const headers = new Headers(init?.headers);
    if (url.endsWith("/admin/oauth/access_token")) {
      calls.push({ url });
      return Response.json(token, {
        status: "access_token" in token ? 200 : 400,
      });
    }
    const { query, variables } = JSON.parse(String(init?.body));
    calls.push({ url, token: headers.get("X-Shopify-Access-Token"), query });
    if (query.includes("query Orders("))
      return Response.json({
        data: {
          orders: {
            nodes: [order],
            pageInfo: { hasNextPage: false, endCursor: null },
          },
        },
      });
    if (query.includes("query OrderNodes("))
      return Response.json({
        data: { nodes: variables.ids.map((id: string) => nodes[id] ?? null) },
      });
    return Response.json({ errors: [{ message: `No ${query}` }] });
  }) as typeof fetch;
  return calls;
}

describe("the workshop", () => {
  test("opens to the Google accounts on its list", async () => {
    const { couple, workshop, signIn } = await setUp();
    expect(await couple.query(api.workshop.access, {})).toEqual({
      signedIn: false,
      googleConfigured: false,
      signInAt: null,
    });
    // Google signs the workshop in once the deployment has its client, and
    // sends it back to the studio's address.
    Object.assign(process.env, google);
    expect(await couple.query(api.workshop.access, {})).toEqual({
      signedIn: false,
      googleConfigured: true,
      signInAt: "https://jolene-studio.vercel.app/studio/atelier",
    });
    expect(await workshop.query(api.workshop.access, {})).toEqual({
      signedIn: true,
      email: "atelier@jolene.ro",
      allowed: true,
    });
    const stranger = await signIn({
      email: "someone@example.com",
      emailVerificationTime: 1,
    });
    expect(await stranger.query(api.workshop.access, {})).toMatchObject({
      allowed: false,
    });
    // An address Google didn't vouch for counts for nothing.
    const unverified = await signIn({ email: "marius@example.com" });
    expect(await unverified.query(api.workshop.access, {})).toMatchObject({
      allowed: false,
    });
    await expect(stranger.action(api.workshop.orders, {})).rejects.toThrow(
      "workshop-only",
    );
    await expect(couple.action(api.workshop.orders, {})).rejects.toThrow(
      "workshop-only",
    );
  });

  test("says when it isn't connected to the store", async () => {
    const { workshop } = await setUp();
    const calls = fakeStore(null);
    expect(await workshop.action(api.workshop.orders, {})).toEqual({
      status: "not-connected",
    });
    expect(calls).toEqual([]);
  });

  test("reads the open orders with their proofs and checks them", async () => {
    const { couple, workshop } = await setUp();
    const designId = await couple.mutation(api.designs.start, {
      template: "sample-invitation",
    });
    const approved = await couple.mutation(api.proofs.approve, {
      designId,
      revision: 1,
      fields: {},
    });
    if (!approved.ok) throw new Error("not approved");
    Object.assign(process.env, store);
    const calls = fakeStore(storeOrder(approved.proofId));

    const read = await workshop.action(api.workshop.orders, {});
    if (read.status !== "read") throw new Error(read.status);
    expect(read.more).toBe(false);
    expect(read.admin).toBe("https://jolene.myshopify.com/admin/orders");
    expect(read.orders).toHaveLength(1);
    const [order] = read.orders;
    expect(order).toMatchObject({
      name: "#1001",
      url: "https://jolene.myshopify.com/admin/orders/7",
      note: "Livrare până pe 1 noiembrie",
      currency: "RON",
      fees: [],
      issues: [],
    });
    expect(order?.lines).toEqual([
      {
        id: "gid://shopify/LineItem/1",
        title: "Invitație Eucalipt",
        variant: null,
        quantity: 60,
        // The proof says when it was approved, so the cart's note of it goes.
        answers: [{ label: "Culoare sigiliu", value: "Auriu" }],
        extras: "150.00",
        proof: {
          id: approved.proofId,
          kind: "invitation",
          suite: { ro: "Eucalipt", en: "Eucalyptus" },
          image: null,
          approvedAt: expect.any(Number),
        },
        issues: [],
      },
    ]);
    expect(calls.map((call) => call.url)).toEqual([
      "https://jolene.myshopify.com/admin/oauth/access_token",
      ...Array(4).fill(
        "https://jolene.myshopify.com/admin/api/2026-10/graphql.json",
      ),
    ]);
    expect(calls.slice(1).every((call) => call.token === "shpat_test")).toBe(
      true,
    );
  });

  test("gives a proof's print file what the couple approved", async () => {
    const { t, couple, workshop } = await setUp();
    const designId = await couple.mutation(api.designs.start, {
      template: "sample-invitation",
    });
    const approved = await couple.mutation(api.proofs.approve, {
      designId,
      revision: 1,
      fields: {},
    });
    if (!approved.ok) throw new Error("not approved");
    await t.run(async (ctx) => {
      const proof = await ctx.db.get("proofs", approved.proofId);
      if (!proof) throw new Error("no proof");
      await ctx.db.insert("assets", {
        key: EUCALYPTUS_ASSET,
        path: "/studio/art/sample/eucalyptus.svg",
        kind: "artwork",
        contentType: "image/svg+xml",
        recolorable: true,
      });
      // The couple's photo, on the front of their invitation: theirs alone.
      await ctx.db.insert("assets", {
        key: "photo-ana-mihai",
        storageId: await ctx.storage.store(
          new Blob(["photo"], { type: "image/jpeg" }),
        ),
        kind: "photo",
        contentType: "image/jpeg",
        recolorable: false,
        ownerId: proof.ownerId,
      });
      const document = structuredClone(proof.document);
      const layers = document.pieces[0].front.layers;
      layers.push({
        ...layers.find((layer: { type: string }) => layer.type === "image"),
        id: "photo",
        asset: "photo-ana-mihai",
      });
      await ctx.db.patch("proofs", proof._id, {
        document,
        fields: { partner1: "Ana", partner2: "Mihai", date: "2027-06-12" },
      });
    });

    const proofId = approved.proofId;
    await expect(
      couple.query(api.workshop.printJob, { proofId }),
    ).rejects.toThrow("workshop-only");
    expect(
      await workshop.query(api.workshop.printJob, { proofId: "not-a-proof" }),
    ).toBeNull();
    const job = await workshop.query(api.workshop.printJob, { proofId });
    expect(job).toMatchObject({
      kind: "invitation",
      suite: { ro: "Eucalipt", en: "Eucalyptus" },
      names: "Ana & Mihai",
      fields: { partner1: "Ana", partner2: "Mihai", date: "2027-06-12" },
      document: { kind: "invitation", occasion: "wedding" },
    });
    expect(job?.assets).toEqual([
      {
        key: EUCALYPTUS_ASSET,
        url: "/studio/art/sample/eucalyptus.svg",
        contentType: "image/svg+xml",
        recolorable: true,
      },
      {
        key: "photo-ana-mihai",
        url: expect.stringMatching(/^https?:\/\//),
        contentType: "image/jpeg",
        recolorable: false,
      },
    ]);
  });

  test("passes on the store's refusal", async () => {
    const { workshop } = await setUp();
    Object.assign(process.env, store);
    fakeStore(null, {
      error: "invalid_client",
      error_description: "Client authentication failed",
    } as never);
    const read = await workshop.action(api.workshop.orders, {});
    expect(read).toEqual({
      status: "failed",
      message:
        "jolene.myshopify.com refused the app's credentials (400, invalid_client: Client authentication failed)",
    });
  });
});
