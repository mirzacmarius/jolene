import { beforeEach, describe, expect, setSystemTime, test } from "bun:test";
import {
  eucaliptInvitation,
  eucaliptMenu,
  eucalyptusArtwork,
} from "@jolene/design";
import { Glob } from "bun";
import { convexTest } from "convex-test";
import { api, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import schema from "./schema";

// convex-test loads the functions from this map, as Vite's import.meta.glob
// would build it.
const modules = Object.fromEntries(
  [...new Glob("**/*.ts").scanSync(import.meta.dir)]
    .filter((path) => !path.endsWith(".test.ts"))
    .map((path) => [`./${path}`, () => import(`./${path}`)]),
);

/** A suite whose invitation the shop sells and whose menu it doesn't yet. */
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
    { slug: "sample-menu", document: eucaliptMenu },
  ],
  art: [
    {
      key: eucalyptusArtwork.key,
      path: "/studio/art/sample/eucalyptus.svg",
      contentType: eucalyptusArtwork.contentType,
      recolorable: true,
      name: eucalyptusArtwork.name,
    },
  ],
};

const names = { partner1: "Ana", partner2: "Mihai" };

/** The first bytes of a PNG, which is all the check reads. */
const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
  .buffer;

async function setUp(template = "sample-invitation") {
  const t = convexTest(schema, modules);
  await t.mutation(internal.catalog.save.suite, sample);
  const signIn = async () => {
    const userId = await t.run((ctx) =>
      ctx.db.insert("users", { isAnonymous: true }),
    );
    // Convex Auth's subject is the user id and the session id.
    return t.withIdentity({ subject: `${userId}|session` });
  };
  const couple = await signIn();
  const designId = await couple.mutation(api.designs.start, { template });
  const design = await couple.query(api.designs.get, { designId });
  const eventId = design?.event._id as Id<"events">;
  await couple.mutation(api.events.setFields, { eventId, fields: names });
  return { t, couple, stranger: await signIn(), designId, eventId };
}

beforeEach(() => setSystemTime());

describe("proofs", () => {
  test("keep the design and details as the couple approved them", async () => {
    const { t, couple, designId, eventId } = await setUp();
    const approved = await couple.mutation(api.proofs.approve, {
      designId,
      revision: 1,
      fields: names,
    });
    if (!approved.ok) throw new Error("not approved");
    const before = await couple.query(api.designs.get, { designId });

    await couple.mutation(api.designs.apply, {
      designId,
      operations: [{ op: "setPalette", palette: { accent: "#000000" } }],
    });
    await couple.mutation(api.events.setFields, {
      eventId,
      fields: { date: "2027-09-04" },
    });

    const proof = await t.run((ctx) => ctx.db.get("proofs", approved.proofId));
    expect(proof?.revision).toBe(1);
    expect(proof?.document).toEqual(before?.design.document);
    expect(proof?.fields).toEqual(names);
    expect(await couple.query(api.proofs.latest, { designId })).toMatchObject({
      _id: approved.proofId,
      revision: 1,
      current: false,
      product: "invitatie-eucalipt",
    });
  });

  test("approve nothing that changed while the couple looked", async () => {
    const { couple, designId } = await setUp();
    expect(
      await couple.mutation(api.proofs.approve, {
        designId,
        revision: 2,
        fields: names,
      }),
    ).toEqual({ ok: false, reason: "stale" });
    expect(
      await couple.mutation(api.proofs.approve, {
        designId,
        revision: 1,
        fields: { partner1: "Ana" },
      }),
    ).toEqual({ ok: false, reason: "stale" });
    expect(await couple.query(api.proofs.latest, { designId })).toBeNull();
  });

  test("give the proof already made when nothing changed", async () => {
    const { couple, designId } = await setUp();
    const args = { designId, revision: 1, fields: names };
    const first = await couple.mutation(api.proofs.approve, args);
    // The same details in another order.
    const second = await couple.mutation(api.proofs.approve, {
      ...args,
      fields: { partner2: "Mihai", partner1: "Ana" },
    });
    expect(second).toEqual(first);
    expect(await couple.query(api.proofs.latest, { designId })).toMatchObject({
      current: true,
    });
  });

  test("belong to their couple", async () => {
    const { couple, stranger, designId } = await setUp();
    await expect(
      stranger.mutation(api.proofs.approve, {
        designId,
        revision: 1,
        fields: names,
      }),
    ).rejects.toThrow("not-found");
    const approved = await couple.mutation(api.proofs.approve, {
      designId,
      revision: 1,
      fields: names,
    });
    if (!approved.ok) throw new Error("not approved");
    expect(await stranger.query(api.proofs.latest, { designId })).toBeNull();
    await expect(
      stranger.action(api.proofs.attachImage, {
        proofId: approved.proofId,
        image: png,
      }),
    ).rejects.toThrow("not-found");
  });

  test("show the shop what it is ordered as, and nothing more", async () => {
    const { couple, designId } = await setUp();
    setSystemTime(new Date("2026-10-20T19:00:00Z"));
    const approved = await couple.mutation(api.proofs.approve, {
      designId,
      revision: 1,
      fields: names,
    });
    if (!approved.ok) throw new Error("not approved");
    // Anyone with the link, signed in or not.
    expect(
      await couple.query(api.proofs.summary, { proofId: approved.proofId }),
    ).toEqual({
      designId,
      kind: "invitation",
      suite: { ro: "Eucalipt", en: "Eucalyptus" },
      product: "invitatie-eucalipt",
      image: null,
      approvedAt: Date.parse("2026-10-20T19:00:00Z"),
    });
    expect(
      await couple.query(api.proofs.summary, { proofId: "not-a-proof" }),
    ).toBeNull();
  });

  test("wait for the shop to sell an item", async () => {
    const { couple, designId } = await setUp("sample-menu");
    const approved = await couple.mutation(api.proofs.approve, {
      designId,
      revision: 1,
      fields: names,
    });
    expect(await couple.query(api.proofs.latest, { designId })).toMatchObject({
      product: null,
    });
    if (!approved.ok) throw new Error("not approved");
    expect(
      await couple.query(api.proofs.summary, { proofId: approved.proofId }),
    ).toMatchObject({ kind: "menu", product: null });
  });

  test("keep one picture each, stored by the studio's upload", async () => {
    const { t, couple, designId } = await setUp();
    const approved = await couple.mutation(api.proofs.approve, {
      designId,
      revision: 1,
      fields: names,
    });
    if (!approved.ok) throw new Error("not approved");
    const { proofId } = approved;
    const imageOf = () =>
      t.run(async (ctx) => (await ctx.db.get("proofs", proofId))?.image);

    await couple.action(api.proofs.attachImage, { proofId, image: png });
    const first = await imageOf();
    expect(
      await t.run((ctx) => ctx.db.system.get("_storage", first as never)),
    ).toMatchObject({ size: png.byteLength });
    expect(
      (await couple.query(api.proofs.summary, { proofId }))?.image,
    ).toBeString();

    // A new picture replaces the old one, whose file goes.
    await couple.action(api.proofs.attachImage, { proofId, image: png });
    expect(await imageOf()).not.toBe(first);
    expect(
      await t.run((ctx) => ctx.db.system.get("_storage", first as never)),
    ).toBeNull();

    await expect(
      couple.action(api.proofs.attachImage, {
        proofId,
        image: new TextEncoder().encode("<svg/>").buffer,
      }),
    ).rejects.toThrow("invalid-image");
  });
});
