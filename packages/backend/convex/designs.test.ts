import { beforeEach, describe, expect, setSystemTime, test } from "bun:test";
import {
  eucaliptFields,
  eucaliptInvitation,
  eucaliptMenu,
  eucaliptPlaceCard,
  eucaliptSaveTheDate,
  eucalyptusArtwork,
} from "@jolene/design";
import { suites } from "@jolene/suites";
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

/** A suite made of @jolene/design's sample documents, to design from. */
const sample = {
  suite: {
    slug: "sample",
    name: { ro: "Eucalipt", en: "Eucalyptus" },
    description: { ro: "Ramuri de eucalipt.", en: "Eucalyptus sprigs." },
    occasion: "wedding" as const,
    styles: ["botanic"],
    published: true,
    sortOrder: 0,
    sampleFields: eucaliptFields as Record<string, string>,
  },
  templates: [
    { slug: "sample-invitation", document: eucaliptInvitation },
    { slug: "sample-save-the-date", document: eucaliptSaveTheDate },
    { slug: "sample-menu", document: eucaliptMenu },
    { slug: "sample-place-card", document: eucaliptPlaceCard },
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

/** Another wedding collection, for a couple who designs from two. */
const other = {
  ...sample,
  suite: {
    ...sample.suite,
    slug: "other",
    name: { ro: "Altă colecție", en: "Another collection" },
    sortOrder: 1,
  },
  templates: sample.templates.map((template) => ({
    ...template,
    slug: template.slug.replace("sample", "other"),
  })),
};

async function setUp() {
  const t = convexTest(schema, modules);
  await t.mutation(internal.catalog.save.suite, sample);
  const signIn = async () => {
    const userId = await t.run((ctx) =>
      ctx.db.insert("users", { isAnonymous: true }),
    );
    // Convex Auth's subject is the user id and the session id.
    return t.withIdentity({ subject: `${userId}|session` });
  };
  return { t, couple: await signIn(), stranger: await signIn() };
}

beforeEach(() => setSystemTime());

describe("the catalog", () => {
  test("is seeded with Jolene's collections and their artwork", async () => {
    const t = convexTest(schema, modules);
    await t.action(internal.init.seed, {});
    const shown = await t.query(api.catalog.suites, {});
    expect(shown.suites.map((suite) => suite.slug)).toEqual(
      suites.map((suite) => suite.slug),
    );
    expect(shown.suites.map((suite) => suite.lead?.slug)).toEqual(
      suites.map((suite) => suite.templates[0]?.slug),
    );
    // The studio serves the artwork itself.
    expect(shown.assets.length).toBeGreaterThan(0);
    for (const asset of shown.assets)
      expect(asset.url).toStartWith("/studio/art/");

    const forest = await t.query(api.catalog.suite, { slug: "forest" });
    expect(forest?.templates.map((template) => template.kind)).toContain(
      "menu",
    );
    // Seeding again updates in place.
    await t.action(internal.init.seed, {});
    expect((await t.query(api.catalog.suites, {})).suites).toHaveLength(
      suites.length,
    );
  });

  test("retires the items a suite no longer lists", async () => {
    const { t, couple } = await setUp();
    const designId = await couple.mutation(api.designs.start, {
      template: "sample-place-card",
    });
    await t.mutation(internal.catalog.save.suite, {
      ...sample,
      templates: sample.templates.slice(0, 3),
    });
    const suite = await t.query(api.catalog.suite, { slug: "sample" });
    expect(suite?.templates.map((template) => template.kind)).toEqual([
      "invitation",
      "save-the-date",
      "menu",
    ]);
    await expect(
      couple.mutation(api.designs.start, { template: "sample-place-card" }),
    ).rejects.toThrow("not-found");
    // Designs started from it keep it.
    const design = await couple.query(api.designs.get, { designId });
    expect(design?.template.slug).toBe("sample-place-card");

    // Listing it again brings it back.
    await t.mutation(internal.catalog.save.suite, sample);
    const again = await t.query(api.catalog.suite, { slug: "sample" });
    expect(again?.templates).toHaveLength(4);
  });

  test("keeps an asset to one file", async () => {
    const { t } = await setUp();
    const storageId = await t.run((ctx) =>
      ctx.storage.store(new Blob(["<svg/>"])),
    );
    const asset = {
      key: "sprig",
      kind: "artwork" as const,
      contentType: "image/svg+xml",
      recolorable: true,
    };
    await expect(
      t.mutation(internal.catalog.save.asset, {
        ...asset,
        storageId,
        path: "/studio/art/sprig.svg",
      }),
    ).rejects.toThrow("give a storageId or a path");
    await t.mutation(internal.catalog.save.asset, { ...asset, storageId });
    // Moving it into the studio deletes the upload.
    await t.mutation(internal.catalog.save.asset, {
      ...asset,
      path: "/studio/art/sprig.svg",
    });
    expect(
      await t.run((ctx) => ctx.db.system.get("_storage", storageId)),
    ).toBeNull();
  });
});

describe("designs", () => {
  test("share the couple's details across a suite", async () => {
    const { couple } = await setUp();
    const invitation = await couple.mutation(api.designs.start, {
      template: "sample-invitation",
    });
    const menu = await couple.mutation(api.designs.start, {
      template: "sample-menu",
    });
    const first = await couple.query(api.designs.get, { designId: invitation });
    const second = await couple.query(api.designs.get, { designId: menu });
    expect(first?.event._id).toBe(second?.event._id as never);
    expect(first?.template).toEqual({
      slug: "sample-invitation",
      suite: { slug: "sample", name: { ro: "Eucalipt", en: "Eucalyptus" } },
    });

    await couple.mutation(api.events.setFields, {
      eventId: first?.event._id as never,
      fields: { partner1: "Ioana", date: "2027-09-04" },
    });
    await couple.mutation(api.events.setFields, {
      eventId: first?.event._id as never,
      fields: { date: "" },
    });
    const after = await couple.query(api.designs.get, { designId: menu });
    expect(after?.event.fields).toEqual({ partner1: "Ioana" });
  });

  test("share the couple's details across collections", async () => {
    const { t, couple, stranger } = await setUp();
    await t.mutation(internal.catalog.save.suite, other);
    const invitation = await couple.mutation(api.designs.start, {
      template: "sample-invitation",
    });
    const first = await couple.query(api.designs.get, { designId: invitation });
    // Until the couple gives some, collections preview with their own.
    expect(await couple.query(api.events.latestFields, {})).toEqual([]);
    const fields = {
      partner1: "Ioana",
      partner2: "Mihai",
      godparents: "Ana și Radu Pop",
    };
    await couple.mutation(api.events.setFields, {
      eventId: first?.event._id as never,
      fields,
    });
    expect(await couple.query(api.events.latestFields, {})).toEqual([
      { occasion: "wedding", fields },
    ]);

    // A design from another collection is of the same wedding.
    const menu = await couple.mutation(api.designs.start, {
      template: "other-menu",
    });
    const second = await couple.query(api.designs.get, { designId: menu });
    expect(second?.event._id).toBe(first?.event._id as never);
    expect(second?.event.fields).toEqual(fields);
    expect(second?.template.suite.slug).toBe("other");
    expect(second?.composed).toBe(false);

    // Nobody else previews with them.
    expect(await stranger.query(api.events.latestFields, {})).toEqual([]);
    expect(await t.query(api.events.latestFields, {})).toEqual([]);
  });

  test("are private to their owner", async () => {
    const { couple, stranger } = await setUp();
    const designId = await couple.mutation(api.designs.start, {
      template: "sample-invitation",
    });
    expect(await stranger.query(api.designs.get, { designId })).toBeNull();
    expect(
      await couple.query(api.designs.get, { designId: "not-an-id" }),
    ).toBeNull();
    await expect(
      stranger.mutation(api.designs.apply, { designId, operations: [] }),
    ).rejects.toThrow("not-found");
    const design = await couple.query(api.designs.get, { designId });
    await expect(
      stranger.mutation(api.events.setFields, {
        eventId: design?.event._id as never,
        fields: { partner1: "Eve" },
      }),
    ).rejects.toThrow("not-found");
  });

  test("refuse details the occasion doesn't have", async () => {
    const { couple } = await setUp();
    const designId = await couple.mutation(api.designs.start, {
      template: "sample-invitation",
    });
    const design = await couple.query(api.designs.get, { designId });
    for (const fields of [{ child: "Sofia" }, { date: "31.12.2027" }] as Record<
      string,
      string
    >[]) {
      await expect(
        couple.mutation(api.events.setFields, {
          eventId: design?.event._id as never,
          fields,
        }),
      ).rejects.toThrow("invalid-field");
    }
  });

  test("change by operations, all or nothing", async () => {
    const { couple } = await setUp();
    const designId = await couple.mutation(api.designs.start, {
      template: "sample-invitation",
    });
    const moved = await couple.mutation(api.designs.apply, {
      designId,
      operations: [{ op: "setPalette", palette: { accent: "#7a4b5c" } }],
    });
    expect(moved).toEqual({ ok: true, revision: 2 });

    const invalid = await couple.mutation(api.designs.apply, {
      designId,
      operations: [
        { op: "setPalette", palette: { accent: "#000000" } },
        { op: "removeLayer", piece: "card", face: "front", layer: "nope" },
      ],
    });
    expect(invalid).toMatchObject({
      ok: false,
      reason: "invalid",
      revision: 2,
    });

    const stale = await couple.mutation(api.designs.apply, {
      designId,
      expectedRevision: 1,
      operations: [{ op: "setPalette", palette: { accent: "#000000" } }],
    });
    expect(stale).toMatchObject({ ok: false, reason: "stale", revision: 2 });

    const design = await couple.query(api.designs.get, { designId });
    expect(design?.design.revision).toBe(2);
    expect(design?.design.document.theme.palette.accent).toBe("#7a4b5c");
  });

  test("keep what the couple picks to order them, apart from the design", async () => {
    const { couple, stranger } = await setUp();
    const designId = await couple.mutation(api.designs.start, {
      template: "sample-invitation",
    });
    const pick = (picked: {
      quantity?: number;
      option?: { name: string; value: string };
      answer?: { key: string; value: string };
    }) => couple.mutation(api.designs.setFinishes, { designId, ...picked });
    await pick({ option: { name: "Carton", value: "Alb mat 300 gr" } });
    await pick({ answer: { key: "culoare-sigiliu", value: "Bronz" } });
    await pick({
      answer: { key: "flori-criogenate", value: "Flori criogenate" },
    });
    // A new pick takes the place of the one before; an empty one is none.
    await pick({ option: { name: "Carton", value: "Alb sidef 300 gr" } });
    await pick({ answer: { key: "flori-criogenate", value: "" } });
    await pick({ quantity: 80 });

    const design = await couple.query(api.designs.get, { designId });
    expect(design?.design.finishes).toEqual({
      quantity: 80,
      options: [{ name: "Carton", value: "Alb sidef 300 gr" }],
      answers: [
        { key: "culoare-sigiliu", value: "Bronz" },
        { key: "flori-criogenate", value: "" },
      ],
    });
    expect(design?.design.revision).toBe(1);

    for (const refused of [
      { quantity: 0 },
      { quantity: 2.5 },
      { quantity: 1000 },
      { option: { name: "Carton", value: "" } },
      { answer: { key: "", value: "Bronz" } },
      { answer: { key: "culoare-sigiliu", value: "A".repeat(201) } },
    ])
      await expect(pick(refused)).rejects.toThrow("invalid-input");
    for (let number = 3; number <= 40; number++)
      await pick({ answer: { key: `optiune-${number}`, value: "Da" } });
    await expect(
      pick({ answer: { key: "optiune-41", value: "Da" } }),
    ).rejects.toThrow("invalid-input");
    await expect(
      stranger.mutation(api.designs.setFinishes, { designId, quantity: 30 }),
    ).rejects.toThrow("not-found");
  });

  test("keep versions: sittings fold, AI changes and restores don't", async () => {
    const { couple } = await setUp();
    setSystemTime(new Date("2027-01-10T10:00:00Z"));
    const designId = await couple.mutation(api.designs.start, {
      template: "sample-invitation",
    });
    const accent = (value: string) => ({
      designId,
      operations: [{ op: "setPalette", palette: { accent: value } }],
    });
    await couple.mutation(api.designs.apply, accent("#111111"));
    setSystemTime(new Date("2027-01-10T10:04:00Z"));
    await couple.mutation(api.designs.apply, accent("#222222"));
    await couple.mutation(api.designs.apply, {
      ...accent("#333333"),
      note: "Darker accent",
    });
    setSystemTime(new Date("2027-01-10T10:30:00Z"));
    await couple.mutation(api.designs.apply, accent("#444444"));

    const versions = await couple.query(api.designs.versions, { designId });
    expect(
      versions.map(({ revision, author, note }) => ({
        revision,
        author,
        note,
      })),
    ).toEqual([
      { revision: 5, author: "person", note: undefined },
      { revision: 4, author: "person", note: "Darker accent" },
      { revision: 3, author: "person", note: undefined },
      { revision: 1, author: "template", note: undefined },
    ]);

    const original = versions.at(-1);
    const restored = await couple.mutation(api.designs.restore, {
      versionId: original?._id as never,
    });
    expect(restored).toBe(6);
    const design = await couple.query(api.designs.get, { designId });
    expect(design?.design.document.theme.palette.accent).toBe("#56664a");
    const after = await couple.query(api.designs.versions, { designId });
    expect(after[0]).toMatchObject({ revision: 6, restoredFrom: 1 });
    expect(after).toHaveLength(5);
  });

  test("list for their owner, newest first", async () => {
    const { couple, stranger } = await setUp();
    setSystemTime(new Date("2027-01-10T10:00:00Z"));
    await couple.mutation(api.designs.start, {
      template: "sample-invitation",
    });
    setSystemTime(new Date("2027-01-10T10:01:00Z"));
    await couple.mutation(api.designs.start, {
      template: "sample-place-card",
    });
    const mine = await couple.query(api.designs.mine, {});
    expect(mine.designs.map((design) => design.kind)).toEqual([
      "place-card",
      "invitation",
    ]);
    expect(mine.events).toHaveLength(1);
    expect(mine.templates.map((template) => template.suite.slug)).toEqual([
      "sample",
      "sample",
    ]);
    expect((await stranger.query(api.designs.mine, {})).designs).toEqual([]);
  });
});

/** The first bytes of a JPEG, which is all the check reads. */
const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46])
  .buffer;

describe("the viewing link", () => {
  test("shows a design to anyone with it, with the details it reads, until it's turned off", async () => {
    const { t, couple, stranger } = await setUp();
    const designId = await couple.mutation(api.designs.start, {
      template: "sample-place-card",
    });
    const started = await couple.query(api.designs.get, { designId });
    expect(started?.design.viewCode).toBeUndefined();
    await couple.mutation(api.events.setFields, {
      eventId: started?.event._id as never,
      fields: {
        partner1: "Ioana",
        partner2: "Andrei",
        guestName: "Familia Ionescu",
        tableName: "7",
        rsvpContact: "0722 123 456",
      },
    });
    expect(
      await t.query(api.designs.view, { code: "nobodys-link" }),
    ).toBeNull();

    const code = await couple.mutation(api.designs.setViewLink, {
      designId,
      on: true,
    });
    if (!code) throw new Error("no code");
    expect(code).toHaveLength(12);
    // Turning it on again keeps the same link.
    expect(
      await couple.mutation(api.designs.setViewLink, { designId, on: true }),
    ).toBe(code);
    expect(
      (await couple.query(api.designs.get, { designId }))?.design.viewCode,
    ).toBe(code);

    // Whoever has the link sees the design, with only the details it reads.
    const shown = await t.query(api.designs.view, { code });
    expect(shown).toMatchObject({
      kind: "place-card",
      occasion: "wedding",
      suite: { ro: "Eucalipt", en: "Eucalyptus" },
      revision: 1,
      image: null,
    });
    expect(shown?.fields).toEqual({
      guestName: "Familia Ionescu",
      tableName: "7",
    });
    expect(shown?.hosts.ro).toContain("Ioana");
    expect(shown?.hosts.ro).toContain("Andrei");

    // Only the couple turns it off.
    await expect(
      stranger.mutation(api.designs.setViewLink, { designId, on: false }),
    ).rejects.toThrow("not-found");
    expect(await t.query(api.designs.view, { code })).not.toBeNull();
    expect(
      await couple.mutation(api.designs.setViewLink, { designId, on: false }),
    ).toBeNull();
    expect(await t.query(api.designs.view, { code })).toBeNull();
    expect(
      (await couple.query(api.designs.get, { designId }))?.design.viewCode,
    ).toBeUndefined();
    // Turned on again, the old link stays dead.
    const again = await couple.mutation(api.designs.setViewLink, {
      designId,
      on: true,
    });
    expect(again).not.toBe(code);
    expect(again).toHaveLength(12);
    expect(await t.query(api.designs.view, { code })).toBeNull();
  });

  test("keeps one picture of the design, which goes with the link", async () => {
    const { t, couple, stranger } = await setUp();
    const designId = await couple.mutation(api.designs.start, {
      template: "sample-invitation",
    });
    const imageOf = () =>
      t.run(async (ctx) => (await ctx.db.get("designs", designId))?.viewImage);
    // No picture is stored while the link is off.
    await expect(
      couple.action(api.designs.attachViewImage, {
        designId,
        revision: 1,
        image: jpeg,
      }),
    ).rejects.toThrow("not-found");
    expect(await imageOf()).toBeNull();

    const code = await couple.mutation(api.designs.setViewLink, {
      designId,
      on: true,
    });
    if (!code) throw new Error("no code");
    await expect(
      stranger.action(api.designs.attachViewImage, {
        designId,
        revision: 1,
        image: jpeg,
      }),
    ).rejects.toThrow("not-found");
    await expect(
      couple.action(api.designs.attachViewImage, {
        designId,
        revision: 1,
        image: new TextEncoder().encode("<svg/>").buffer,
      }),
    ).rejects.toThrow("invalid-image");

    await couple.action(api.designs.attachViewImage, {
      designId,
      revision: 1,
      image: jpeg,
    });
    const first = await imageOf();
    expect(
      await t.run((ctx) => ctx.db.system.get("_storage", first as never)),
    ).toMatchObject({ size: jpeg.byteLength });
    const shown = await t.query(api.designs.view, { code });
    expect(shown?.image).toBeString();
    expect(
      (await couple.query(api.designs.get, { designId }))?.design
        .viewImageRevision,
    ).toBe(1);

    // A new picture replaces the old one, whose file goes.
    await couple.action(api.designs.attachViewImage, {
      designId,
      revision: 2,
      image: jpeg,
    });
    const second = await imageOf();
    expect(second).not.toBe(first);
    expect(
      await t.run((ctx) => ctx.db.system.get("_storage", first as never)),
    ).toBeNull();

    // Turning the link off deletes the picture with it.
    await couple.mutation(api.designs.setViewLink, { designId, on: false });
    expect(await imageOf()).toBeNull();
    expect(
      await t.run((ctx) => ctx.db.system.get("_storage", second as never)),
    ).toBeNull();
  });
});
