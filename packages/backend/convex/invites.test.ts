import {
  afterEach,
  beforeEach,
  describe,
  expect,
  setSystemTime,
  spyOn,
  test,
} from "bun:test";
import { eucaliptInvitation, eucalyptusArtwork } from "@jolene/design";
import { digitalInvitation } from "@jolene/products/digital-invitation";
import { exportJWK, exportPKCS8, generateKeyPair } from "jose";
import { testConvex } from "../test/convex";
import { api, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { isSlug, romanianDate, slugify, suggestedSlug } from "./invites/codes";
import { type PaidLine, unlockPaid } from "./invites/unlock";
import type { HouseholdInput, ReplyInput } from "./invites/validators";

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

const names = { partner1: "Ana", partner2: "Mihai", rsvpBy: "2027-05-15" };

/** The environment the tests sign in with, set before each and cleared. */
const authEnv = [
  "SITE_URL",
  "CONVEX_SITE_URL",
  "JWT_PRIVATE_KEY",
  "JWKS",
  "AUTH_LOG_CODES",
  "RESEND_API_KEY",
] as const;

async function signingKeys() {
  const keys = await generateKeyPair("RS256", { extractable: true });
  const privateKey = await exportPKCS8(keys.privateKey);
  const publicKey = await exportJWK(keys.publicKey);
  return {
    JWT_PRIVATE_KEY: privateKey.trimEnd().replace(/\n/g, " "),
    JWKS: JSON.stringify({ keys: [{ use: "sig", ...publicKey }] }),
  };
}

const keys = await signingKeys();

beforeEach(() => {
  setSystemTime(new Date("2027-03-01T10:00:00Z"));
  Object.assign(process.env, {
    SITE_URL: "http://localhost:3024/studio",
    CONVEX_SITE_URL: "https://jolene-test.convex.site",
    AUTH_LOG_CODES: "1",
    ...keys,
  });
  Reflect.deleteProperty(process.env, "RESEND_API_KEY");
});

afterEach(() => {
  setSystemTime();
  for (const name of authEnv) Reflect.deleteProperty(process.env, name);
});

async function setUp() {
  const t = testConvex();
  await t.mutation(internal.catalog.save.suite, sample);
  /** A visitor with a session, as Convex Auth signs them in. */
  const visit = async (user: { email?: string; isAnonymous?: boolean }) => {
    const userId = await t.run((ctx) =>
      ctx.db.insert("users", {
        ...user,
        ...(user.email && { emailVerificationTime: Date.now() }),
      }),
    );
    const sessionId = await t.run((ctx) =>
      ctx.db.insert("authSessions", {
        userId,
        expirationTime: Date.now() + 86_400_000,
      }),
    );
    return {
      userId,
      as: t.withIdentity({ subject: `${userId}|${sessionId}` }),
    };
  };
  const owner = await visit({ email: "ana@example.com" });
  const designId = await owner.as.mutation(api.designs.start, {
    template: "sample-invitation",
  });
  const design = await owner.as.query(api.designs.get, { designId });
  const eventId = design?.event._id as Id<"events">;
  await owner.as.mutation(api.events.setFields, { eventId, fields: names });
  return { t, visit, owner, designId, eventId };
}

/** A couple with their digital invitation started and families on it. */
async function withInvite(families = 2) {
  const setup = await setUp();
  const { owner, designId, eventId } = setup;
  const inviteId = await owner.as.mutation(api.invites.create, {
    eventId,
    designId,
  });
  const householdIds = await owner.as.mutation(api.households.add, {
    inviteId,
    households: Array.from({ length: families }, (_, i) =>
      family(`Familia ${i + 1}`),
    ),
  });
  const codes = await setup.t.run(async (ctx) =>
    Promise.all(
      householdIds.map(
        async (id) => (await ctx.db.get("households", id))?.code as string,
      ),
    ),
  );
  return { ...setup, inviteId, householdIds, codes };
}

const family = (name: string, seats = 2): HouseholdInput => ({
  name,
  seats,
  plusOne: false,
});

const coming: ReplyInput = {
  coming: true,
  guests: [
    { name: "Ioana", child: false, meal: "Meniu vegetarian" },
    { name: "Radu", child: false, meal: "Meniu standard" },
  ],
  allergies: "Nuci",
  message: "Abia așteptăm!",
};

async function errorOf(promise: Promise<unknown>) {
  try {
    await promise;
  } catch (error) {
    return (error as { data?: unknown }).data;
  }
  return null;
}

describe("accounts", () => {
  test("sign in with an emailed code, taking the anonymous designs along", async () => {
    const { t, visit } = await setUp();
    const anonymous = await visit({ isAnonymous: true });
    const designId = await anonymous.as.mutation(api.designs.start, {
      template: "sample-invitation",
    });
    const log = spyOn(console, "log").mockImplementation(() => {});
    try {
      const email = "mihai@example.com";
      await anonymous.as.action(api.auth.signIn, {
        provider: "email",
        params: { email },
      });
      const line = log.mock.calls.map((call) => String(call[0])).join("\n");
      const code = /Sign-in code for mihai@example\.com: (\d{8})/.exec(
        line,
      )?.[1];
      expect(code).toBeDefined();
      const signedIn = await anonymous.as.action(api.auth.signIn, {
        provider: "email",
        params: { email, code },
      });
      expect(signedIn.tokens).toBeDefined();
    } finally {
      log.mockRestore();
    }
    const account = await t.run((ctx) =>
      ctx.db
        .query("users")
        .withIndex("email", (q) => q.eq("email", "mihai@example.com"))
        .unique(),
    );
    const design = await t.run((ctx) => ctx.db.get("designs", designId));
    expect(account?.isAnonymous).toBeUndefined();
    expect(design?.ownerId).toBe(account?._id as Id<"users">);
    const event = await t.run((ctx) =>
      ctx.db.get("events", design?.eventId as Id<"events">),
    );
    expect(event?.ownerId).toBe(account?._id as Id<"users">);
  });

  test("refuse a wrong code", async () => {
    const { visit } = await setUp();
    const anonymous = await visit({ isAnonymous: true });
    const log = spyOn(console, "log").mockImplementation(() => {});
    try {
      await anonymous.as.action(api.auth.signIn, {
        provider: "email",
        params: { email: "mihai@example.com" },
      });
    } finally {
      log.mockRestore();
    }
    await expect(
      anonymous.as.action(api.auth.signIn, {
        provider: "email",
        params: { email: "mihai@example.com", code: "00000000" },
      }),
    ).rejects.toThrow();
  });

  test("send one address a few codes at a time", async () => {
    const { visit } = await setUp();
    const anonymous = await visit({ isAnonymous: true });
    const log = spyOn(console, "log").mockImplementation(() => {});
    try {
      const ask = () =>
        anonymous.as.action(api.auth.signIn, {
          provider: "email",
          params: { email: "mihai@example.com" },
        });
      for (let i = 0; i < 3; i++) await ask();
      expect(await errorOf(ask())).toBe("too-many");
    } finally {
      log.mockRestore();
    }
  });

  test("say who's signed in and whether codes can go out", async () => {
    const { owner, visit } = await setUp();
    expect(await owner.as.query(api.accounts.me, {})).toEqual({
      kind: "account",
      email: "ana@example.com",
      emailSignIn: true,
    });
    const anonymous = await visit({ isAnonymous: true });
    expect(await anonymous.as.query(api.accounts.me, {})).toMatchObject({
      kind: "anonymous",
    });
    Reflect.deleteProperty(process.env, "AUTH_LOG_CODES");
    expect(await anonymous.as.query(api.accounts.me, {})).toMatchObject({
      emailSignIn: false,
    });
  });
});

describe("digital invitations", () => {
  test("need an account, not an anonymous session", async () => {
    const { visit } = await setUp();
    const anonymous = await visit({ isAnonymous: true });
    const designId = await anonymous.as.mutation(api.designs.start, {
      template: "sample-invitation",
    });
    const design = await anonymous.as.query(api.designs.get, { designId });
    const eventId = design?.event._id as Id<"events">;
    expect(
      await errorOf(
        anonymous.as.mutation(api.invites.create, { eventId, designId }),
      ),
    ).toBe("account-needed");
    expect(
      await anonymous.as.query(api.invites.dashboard, { eventId }),
    ).toEqual({ kind: "account-needed" });
  });

  test("start from the invitation design, at an address made of the names", async () => {
    const { t, owner, visit, eventId, inviteId } = await withInvite(0);
    const dashboard = await owner.as.query(api.invites.dashboard, { eventId });
    if (dashboard.kind !== "ready") throw new Error(dashboard.kind);
    expect(dashboard.role).toBe("owner");
    expect(dashboard.invite).toMatchObject({
      _id: inviteId,
      slug: "ana-si-mihai",
      language: "ro",
      open: true,
      questions: {
        meals: ["Meniu standard", "Meniu vegetarian", "Meniu pentru copii"],
        allergies: true,
      },
      published: { revision: 1, image: null },
    });
    // Another couple with the same names gets the next address.
    const other = await visit({ email: "ana.dobre@example.com" });
    const designId = await other.as.mutation(api.designs.start, {
      template: "sample-invitation",
    });
    const design = await other.as.query(api.designs.get, { designId });
    const otherEvent = design?.event._id as Id<"events">;
    await other.as.mutation(api.events.setFields, {
      eventId: otherEvent,
      fields: names,
    });
    const second = await other.as.mutation(api.invites.create, {
      eventId: otherEvent,
      designId,
    });
    const invite = await t.run((ctx) => ctx.db.get("invites", second));
    expect(invite?.slug).toBe("ana-si-mihai-2");
  });

  test("keep its address unless it's free and well formed", async () => {
    const { owner, inviteId } = await withInvite(0);
    expect(
      await errorOf(
        owner.as.mutation(api.invites.setSlug, { inviteId, slug: "Ana Mihai" }),
      ),
    ).toBe("invalid-slug");
    expect(
      await errorOf(
        owner.as.mutation(api.invites.setSlug, { inviteId, slug: "api" }),
      ),
    ).toBe("invalid-slug");
    await owner.as.mutation(api.invites.setSlug, {
      inviteId,
      slug: "nunta-ana-mihai",
    });
    const opened = await owner.as.query(api.guests.open, {
      slug: "ana-si-mihai",
    });
    expect(opened.kind).toBe("not-found");
  });

  test("open to the first families only, until it's paid for", async () => {
    const { t, codes } = await withInvite(4);
    const open = (code?: string) =>
      t.query(api.guests.open, { slug: "ana-si-mihai", code });
    const first = await open(codes[0]);
    if (first.kind !== "ready") throw new Error(first.kind);
    expect(first.fields.guestName).toBe("Familia 1");
    expect(first.hosts).toBe("Ana și Mihai");
    expect(first.household).toMatchObject({ name: "Familia 1", seats: 2 });
    expect((await open(codes[3])).kind).toBe("locked");
    expect((await open()).kind).toBe("locked");
    expect((await open("nothing1")).kind).toBe("not-found");

    const event = await eventOf(t, codes[0] as string);
    await paid(t, "1001", [{ ...bought, event: event ?? undefined }]);
    expect((await open(codes[3])).kind).toBe("ready");
    const general = await open();
    expect(general.kind).toBe("ready");
    if (general.kind === "ready") expect(general.household).toBeNull();
  });

  test("unlock only for the digital invitation's own product", async () => {
    const { t, eventId, codes } = await withInvite(4);
    const unlocked = await paid(t, "1002", [
      { product: "invitatie-eucalipt", quantity: 1, event: eventId },
    ]);
    expect(unlocked).toBe(0);
    const opened = await t.query(api.guests.open, {
      slug: "ana-si-mihai",
      code: codes[3],
    });
    expect(opened.kind).toBe("locked");
  });

  test("come free with printed invitations", async () => {
    const { t, owner, designId, eventId } = await setUp();
    const approved = await owner.as.mutation(api.proofs.approve, {
      designId,
      revision: 1,
      fields: names,
    });
    if (!approved.ok) throw new Error("not approved");
    const line = { product: "invitatie-eucalipt", proof: approved.proofId };
    // A few cards are a sample, not the wedding's invitations.
    expect(await paid(t, "1003", [{ ...line, quantity: 2 }])).toBe(0);
    expect(await paid(t, "1004", [{ ...line, quantity: 60 }])).toBe(1);
    // The same order again changes nothing.
    expect(await paid(t, "1004", [{ ...line, quantity: 60 }])).toBe(0);
    const dashboard = await owner.as.query(api.invites.dashboard, { eventId });
    if (dashboard.kind !== "ready") throw new Error(dashboard.kind);
    expect(dashboard.invite?.unlocked).toMatchObject({
      by: "print",
      order: "1004",
    });
    // Before the couple published a design, guests see nothing yet.
    expect(dashboard.invite?.published).toBeNull();
  });

  test("unlock by hand, for a couple who paid another way", async () => {
    const { t, owner, eventId, codes } = await withInvite(4);
    const byHand = (event: string, note: string) =>
      t.mutation(internal.invites.unlock.byHand, { event, note });
    expect(await byHand(` ${eventId} `, " Transfer 21.10 ")).toBe(true);
    expect(await byHand(eventId, "Again")).toBe(false);
    const opened = await t.query(api.guests.open, {
      slug: "ana-si-mihai",
      code: codes[3],
    });
    expect(opened.kind).toBe("ready");
    const dashboard = await owner.as.query(api.invites.dashboard, { eventId });
    if (dashboard.kind !== "ready") throw new Error(dashboard.kind);
    expect(dashboard.invite?.unlocked).toMatchObject({
      by: "hand",
      order: "Transfer 21.10",
    });
    await expect(byHand("nothing", "")).rejects.toThrow("No event");
  });

  test("take a family's reply through their link, keeping each in the history", async () => {
    const { t, owner, inviteId, householdIds, codes } = await withInvite();
    const code = codes[0] as string;
    await t.mutation(api.guests.reply, {
      slug: "ana-si-mihai",
      code,
      reply: coming,
    });
    await t.mutation(api.guests.reply, {
      slug: "ana-si-mihai",
      code,
      reply: { coming: false, guests: [], message: "Ne pare rău" },
    });
    const household = await t.run((ctx) =>
      ctx.db.get("households", householdIds[0] as Id<"households">),
    );
    expect(household?.reply).toMatchObject({
      coming: false,
      guests: [],
      by: "guest",
    });
    const history = await owner.as.query(api.invites.history, { inviteId });
    expect(history.map((entry) => entry.reply.coming)).toEqual([false, true]);
    expect(history[1]?.reply.guests).toEqual([
      { name: "Ioana", child: false, meal: "Meniu vegetarian" },
      { name: "Radu", child: false, meal: "Meniu standard" },
    ]);
    expect(history[1]?.household).toBe("Familia 1");
  });

  test("refuse more people than invited, or meals not offered", async () => {
    const { t, codes } = await withInvite();
    const reply = (value: ReplyInput) =>
      errorOf(
        t.mutation(api.guests.reply, {
          slug: "ana-si-mihai",
          code: codes[0] as string,
          reply: value,
        }),
      );
    const guest = { name: "Ioana", child: false };
    expect(await reply({ coming: true, guests: [guest, guest, guest] })).toBe(
      "invalid-input",
    );
    expect(
      await reply({ coming: true, guests: [{ ...guest, plusOne: true }] }),
    ).toBe("invalid-input");
    expect(
      await reply({ coming: true, guests: [{ ...guest, meal: "Pește" }] }),
    ).toBe("invalid-input");
    expect(await reply({ coming: true, guests: [] })).toBe("invalid-input");
  });

  test("close replies after the reply date, in Romania's day", async () => {
    const { t, codes } = await withInvite();
    const reply = () =>
      errorOf(
        t.mutation(api.guests.reply, {
          slug: "ana-si-mihai",
          code: codes[0] as string,
          reply: coming,
        }),
      );
    // 23:30 in Bucharest on the 15th: still the reply date.
    setSystemTime(new Date("2027-05-15T20:30:00Z"));
    expect(await reply()).toBeNull();
    setSystemTime(new Date("2027-05-15T21:30:00Z"));
    expect(await reply()).toBe("reply-closed");
  });

  test("add a family that replies through the open link", async () => {
    const { t, owner, eventId } = await withInvite();
    await paid(t, "1005", [{ ...bought, event: eventId }]);
    const code = await t.mutation(api.guests.join, {
      slug: "ana-si-mihai",
      name: "Familia Ionescu",
      reply: coming,
    });
    const opened = await t.query(api.guests.open, {
      slug: "ana-si-mihai",
      code,
    });
    if (opened.kind !== "ready") throw new Error(opened.kind);
    expect(opened.household).toMatchObject({
      name: "Familia Ionescu",
      seats: 2,
      reply: { coming: true },
    });
    const dashboard = await owner.as.query(api.invites.dashboard, { eventId });
    if (dashboard.kind !== "ready") throw new Error(dashboard.kind);
    expect(dashboard.households.at(-1)).toMatchObject({
      name: "Familia Ionescu",
      source: "open",
    });
  });

  test("keep to personal links when the couple closes the open one", async () => {
    const { t, owner, inviteId, eventId } = await withInvite();
    await paid(t, "1006", [{ ...bought, event: eventId }]);
    await owner.as.mutation(api.invites.update, { inviteId, open: false });
    expect(
      (await t.query(api.guests.open, { slug: "ana-si-mihai" })).kind,
    ).toBe("personal");
    expect(
      await errorOf(
        t.mutation(api.guests.join, {
          slug: "ana-si-mihai",
          name: "Familia Ionescu",
          reply: coming,
        }),
      ),
    ).toBe("invite-locked");
  });

  test("note when a family first opens it", async () => {
    const { t, householdIds, codes } = await withInvite();
    await t.mutation(api.guests.seen, {
      slug: "ana-si-mihai",
      code: codes[1] as string,
    });
    const household = await t.run((ctx) =>
      ctx.db.get("households", householdIds[1] as Id<"households">),
    );
    expect(household?.openedAt).toBe(Date.now());
  });

  test("let the couple take a reply on the phone, after the date too", async () => {
    const { t, owner, householdIds } = await withInvite();
    setSystemTime(new Date("2027-06-01T10:00:00Z"));
    await owner.as.mutation(api.households.takeReply, {
      householdId: householdIds[1] as Id<"households">,
      reply: coming,
    });
    const household = await t.run((ctx) =>
      ctx.db.get("households", householdIds[1] as Id<"households">),
    );
    expect(household?.reply).toMatchObject({ coming: true, by: "couple" });
  });

  test("hold families of a few seats each, with tidy details", async () => {
    const { owner, inviteId } = await withInvite(0);
    const add = (household: HouseholdInput) =>
      errorOf(
        owner.as.mutation(api.households.add, {
          inviteId,
          households: [household],
        }),
      );
    expect(await add({ ...family("Familia 1"), seats: 0 })).toBe(
      "invalid-input",
    );
    expect(await add({ ...family("Familia 1"), seats: 13 })).toBe(
      "invalid-input",
    );
    expect(await add({ ...family("   "), seats: 2 })).toBe("invalid-input");
    expect(await add({ ...family("Familia 1"), email: "not an email" })).toBe(
      "invalid-input",
    );
    expect(
      await add({
        ...family("Familia 1"),
        email: " Ioana@Example.com ",
        phone: "0722 123 456",
      }),
    ).toBeNull();
  });

  test("email no one while Resend isn't set up", async () => {
    const { owner, inviteId, householdIds } = await withInvite();
    await owner.as.mutation(api.households.update, {
      householdId: householdIds[0] as Id<"households">,
      household: { ...family("Familia 1"), email: "ioana@example.com" },
    });
    expect(
      await errorOf(
        owner.as.mutation(api.invites.sendEmails, {
          inviteId,
          householdIds: householdIds as Id<"households">[],
        }),
      ),
    ).toBe("email-unavailable");
  });

  test("show a bounced email on its family", async () => {
    const { t, inviteId, householdIds } = await withInvite();
    const householdId = householdIds[0] as Id<"households">;
    await t.run((ctx) =>
      ctx.db.insert("inviteEmails", {
        inviteId,
        householdId,
        emailId: "email-1",
        to: "ioana@example.com",
        status: "queued",
        updatedAt: Date.now(),
      }),
    );
    const data = {
      email_id: "resend-1",
      created_at: "2027-03-01T10:00:00Z",
      from: "Jolene <salut@jolene.ro>",
      to: ["ioana@example.com"],
      subject: "Invitație la nuntă",
    };
    await t.mutation(internal.emails.onEvent, {
      id: "email-1" as never,
      event: {
        type: "email.bounced",
        created_at: "2027-03-01T10:00:00Z",
        data: {
          ...data,
          bounce: {
            message: "No mailbox",
            subType: "General",
            type: "Permanent",
          },
        },
      } as never,
    });
    // A late "delivered" doesn't take it back.
    await t.mutation(internal.emails.onEvent, {
      id: "email-1" as never,
      event: {
        type: "email.delivered",
        created_at: "2027-03-01T10:01:00Z",
        data,
      } as never,
    });
    const household = await t.run((ctx) =>
      ctx.db.get("households", householdId),
    );
    expect(household?.emailed?.status).toBe("bounced");
  });
});

describe("partners", () => {
  test("join by the couple's link and manage the guest list too", async () => {
    const { owner, visit, inviteId, eventId } = await withInvite(1);
    const code = await owner.as.mutation(api.invites.setPartnerLink, {
      inviteId,
      on: true,
    });
    if (!code) throw new Error("no link");
    const partner = await visit({ email: "mihai@example.com" });
    expect(
      await partner.as.query(api.partners.preview, { code, language: "ro" }),
    ).toMatchObject({ eventId, hosts: "Ana și Mihai", viewer: "can-join" });
    expect(await partner.as.query(api.invites.dashboard, { eventId })).toEqual({
      kind: "not-found",
    });

    expect(await partner.as.mutation(api.partners.join, { code })).toBe(
      eventId,
    );
    const dashboard = await partner.as.query(api.invites.dashboard, {
      eventId,
    });
    if (dashboard.kind !== "ready") throw new Error(dashboard.kind);
    expect(dashboard.role).toBe("partner");
    expect(dashboard.people.map((person) => person.email)).toEqual([
      "ana@example.com",
      "mihai@example.com",
    ]);
    await partner.as.mutation(api.households.add, {
      inviteId,
      households: [family("Familia Dobre")],
    });
    const mine = await partner.as.query(api.invites.mine, {});
    expect(mine).toMatchObject([{ eventId, role: "partner" }]);

    // A new link replaces the old one; who joined stays.
    await owner.as.mutation(api.invites.setPartnerLink, {
      inviteId,
      on: false,
    });
    expect(
      await partner.as.query(api.partners.preview, { code, language: "ro" }),
    ).toBeNull();
    const stranger = await visit({ email: "dan@example.com" });
    expect(
      await errorOf(stranger.as.mutation(api.partners.join, { code })),
    ).toBe("not-found");
    expect(
      (await partner.as.query(api.invites.dashboard, { eventId })).kind,
    ).toBe("ready");

    // Only the owner removes a partner; a partner may leave.
    expect(
      await errorOf(
        partner.as.mutation(api.partners.remove, {
          eventId,
          userId: owner.userId,
        }),
      ),
    ).toBe("not-found");
    await owner.as.mutation(api.partners.remove, {
      eventId,
      userId: partner.userId,
    });
    expect(
      (await partner.as.query(api.invites.dashboard, { eventId })).kind,
    ).toBe("not-found");
  });
});

describe("links", () => {
  test("make addresses from the names, without diacritics", () => {
    expect(slugify("Ștefan Ionuț-Bogdan")).toBe("stefan-ionut-bogdan");
    expect(
      suggestedSlug("wedding", { partner1: "Ioana Maria", partner2: "Ștefan" }),
    ).toBe("ioana-si-stefan");
    expect(suggestedSlug("christening", { child: "Sofia" })).toBe(
      "botez-sofia",
    );
    expect(suggestedSlug("wedding", {})).toBe("nunta");
    expect(isSlug("ana-si-mihai")).toBe(true);
    expect(isSlug("ana--mihai")).toBe(false);
    expect(isSlug("studio")).toBe(false);
    expect(isSlug("vc-ap-32750a")).toBe(false);
  });

  test("tell Romania's day, summer time included", () => {
    expect(romanianDate(Date.parse("2027-01-10T21:59:00Z"))).toBe("2027-01-10");
    expect(romanianDate(Date.parse("2027-01-10T22:00:00Z"))).toBe("2027-01-11");
    expect(romanianDate(Date.parse("2027-07-10T20:59:00Z"))).toBe("2027-07-10");
    expect(romanianDate(Date.parse("2027-07-10T21:00:00Z"))).toBe("2027-07-11");
  });
});

/** The digital invitation, as a paid order's line carries it. */
const bought = { product: digitalInvitation.handle, quantity: 1 };

/** An order the checkout records as paid. */
async function paid(
  t: ReturnType<typeof testConvex>,
  order: string,
  lines: PaidLine[],
) {
  return await t.run((ctx) => unlockPaid(ctx, order, lines));
}

async function eventOf(t: ReturnType<typeof testConvex>, code: string) {
  return await t.run(async (ctx) => {
    const household = (await ctx.db.query("households").take(100)).find(
      (entry) => entry.code === code,
    );
    const invite =
      household && (await ctx.db.get("invites", household.inviteId));
    return invite?.eventId ?? null;
  });
}
