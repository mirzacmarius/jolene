import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { testConvex } from "../../test/convex";
import { api, internal } from "../_generated/api";
import { signInReturn } from "./google";

const googleEnv = [
  "WORKSHOP_EMAILS",
  "SITE_URL",
  "SHOP_URL",
  "AUTH_GOOGLE_ID",
  "AUTH_GOOGLE_SECRET",
  "AUTH_LOG_CODES",
] as const;

beforeEach(() => {
  Object.assign(process.env, {
    WORKSHOP_EMAILS: "Atelier@Jolene.ro, marius@example.com",
    SITE_URL: "https://jolene-studio.vercel.app/studio",
    SHOP_URL: "https://www.orvibo.it",
    AUTH_GOOGLE_ID: "client.apps.googleusercontent.com",
    AUTH_GOOGLE_SECRET: "secret",
    AUTH_LOG_CODES: "1",
  });
});

// The functions read the environment through the same process.env object.
afterEach(() => {
  for (const name of googleEnv) Reflect.deleteProperty(process.env, name);
});

const origins = ["https://www.orvibo.it", "https://jolene-studio.vercel.app"];

type Test = ReturnType<typeof testConvex>;

/**
 * Signs in with Google as Convex Auth does once Google answers: the verifier
 * the studio keeps, the account Google's profile makes or finds, and the code
 * the studio trades for a session.
 */
async function signInWithGoogle(
  t: Test,
  google: { sub: string; email: string; verified: boolean },
) {
  const verifier = await t.mutation(internal.auth.store, {
    args: { type: "verifier" },
  });
  if (typeof verifier !== "string") throw new Error("no verifier");
  const signature = `signature-${google.sub}`;
  await t.mutation(internal.auth.store, {
    args: { type: "verifierSignature", verifier, signature },
  });
  const code = await t.mutation(internal.auth.store, {
    args: {
      type: "userOAuth",
      provider: "google",
      providerAccountId: google.sub,
      profile: {
        name: "Ana Pop",
        email: google.email,
        emailVerified: google.verified,
      },
      signature,
    },
  });
  if (typeof code !== "string") throw new Error("no code");
  const signedIn = await t.mutation(internal.auth.store, {
    args: {
      type: "verifyCodeAndSignIn",
      params: { code },
      verifier,
      generateTokens: false,
      allowExtraProviders: false,
    },
  });
  if (typeof signedIn !== "object" || !signedIn || !("sessionId" in signedIn))
    throw new Error("not signed in");
  return t.withIdentity({
    subject: `${signedIn.userId}|${signedIn.sessionId}`,
  });
}

/** An account made with a code sent to `email`, as couples' are. */
async function signInWithCode(t: Test, email: string) {
  const userId = await t.run(async (ctx) => {
    const userId = await ctx.db.insert("users", {
      email,
      emailVerificationTime: 1,
    });
    await ctx.db.insert("authAccounts", {
      userId,
      provider: "email",
      providerAccountId: email,
      emailVerified: email,
    });
    return userId;
  });
  return t.withIdentity({ subject: `${userId}|session` });
}

describe("the workshop's Google sign-in", () => {
  test("says how the team signs in, and where Google can bring it back", async () => {
    const t = testConvex();
    expect(await t.query(api.workshop.access, {})).toEqual({
      signedIn: false,
      google: { origins },
    });
    Reflect.deleteProperty(process.env, "AUTH_GOOGLE_SECRET");
    expect(await t.query(api.workshop.access, {})).toEqual({
      signedIn: false,
      google: null,
    });
  });

  test("opens the workshop to a listed address Google vouches for", async () => {
    const t = testConvex();
    const atelier = await signInWithGoogle(t, {
      sub: "g-atelier",
      email: "atelier@jolene.ro",
      verified: true,
    });
    expect(await atelier.query(api.workshop.access, {})).toEqual({
      signedIn: true,
      email: "atelier@jolene.ro",
      listed: true,
      allowed: true,
      google: { origins },
    });
    const page = await atelier.query(api.workshop.orders, {
      paginationOpts: { numItems: 10, cursor: null },
    });
    expect(page.page).toEqual([]);
  });

  test("keeps it closed to anyone else", async () => {
    const t = testConvex();
    const stranger = await signInWithGoogle(t, {
      sub: "g-stranger",
      email: "someone@gmail.com",
      verified: true,
    });
    // An address Google didn't check counts for nothing.
    const unverified = await signInWithGoogle(t, {
      sub: "g-unverified",
      email: "marius@example.com",
      verified: false,
    });
    expect(await stranger.query(api.workshop.access, {})).toMatchObject({
      listed: false,
      allowed: false,
    });
    expect(await unverified.query(api.workshop.access, {})).toMatchObject({
      listed: false,
      allowed: false,
    });
    for (const visitor of [stranger, unverified])
      await expect(
        visitor.query(api.workshop.orders, {
          paginationOpts: { numItems: 10, cursor: null },
        }),
      ).rejects.toThrow("workshop-only");
  });

  test("asks an account that had a code to sign in with Google, and keeps it", async () => {
    const t = testConvex();
    const byCode = await signInWithCode(t, "marius@example.com");
    expect(await byCode.query(api.workshop.access, {})).toMatchObject({
      listed: true,
      allowed: false,
    });
    await expect(
      byCode.query(api.workshop.orders, {
        paginationOpts: { numItems: 10, cursor: null },
      }),
    ).rejects.toThrow("workshop-only");
    // Without Google's client, the code is enough, as it always was.
    Reflect.deleteProperty(process.env, "AUTH_GOOGLE_ID");
    expect(await byCode.query(api.workshop.access, {})).toMatchObject({
      allowed: true,
      google: null,
    });
    process.env.AUTH_GOOGLE_ID = "client.apps.googleusercontent.com";
    // Google signs the same address in to the same account.
    const byGoogle = await signInWithGoogle(t, {
      sub: "g-marius",
      email: "marius@example.com",
      verified: true,
    });
    const users = await t.run((ctx) =>
      ctx.db
        .query("users")
        .withIndex("email", (q) => q.eq("email", "marius@example.com"))
        .take(5),
    );
    expect(users).toHaveLength(1);
    expect(await byGoogle.query(api.workshop.access, {})).toMatchObject({
      email: "marius@example.com",
      allowed: true,
    });
  });

  test("sends no code to a workshop address once the team signs in with Google", async () => {
    const t = testConvex();
    for (const email of ["atelier@jolene.ro", " MARIUS@example.com"])
      await expect(
        t.mutation(internal.accounts.sendCode, { email, code: "12345678" }),
      ).rejects.toThrow("use-google");
    // Couples still get theirs.
    expect(
      await t.mutation(internal.accounts.sendCode, {
        email: "ana@example.com",
        code: "12345678",
      }),
    ).toBeNull();
    Reflect.deleteProperty(process.env, "AUTH_GOOGLE_ID");
    expect(
      await t.mutation(internal.accounts.sendCode, {
        email: "atelier@jolene.ro",
        code: "12345678",
      }),
    ).toBeNull();
  });
});

describe("where Google brings the team back", () => {
  test("to the studio page it set off from, on the shop's address or the studio's", () => {
    for (const url of [
      "https://www.orvibo.it/studio/atelier",
      "https://www.orvibo.it/studio/en/atelier/J1001?tab=history",
      "https://jolene-studio.vercel.app/studio/atelier/produse",
      "https://jolene-studio.vercel.app/studio",
    ])
      expect(signInReturn(url)).toBe(url);
  });

  test("to a path on SITE_URL, as Convex Auth allows by default", () => {
    expect(signInReturn("/atelier")).toBe(
      "https://jolene-studio.vercel.app/studio/atelier",
    );
    expect(signInReturn("?x=1")).toBe(
      "https://jolene-studio.vercel.app/studio?x=1",
    );
  });

  test("nowhere else", () => {
    for (const url of [
      "https://evil.example/studio/atelier",
      "https://www.orvibo.it.evil.example/studio/atelier",
      "https://www.orvibo.it/cart",
      "https://www.orvibo.it/studiox",
      "http://www.orvibo.it/studio/atelier",
      "javascript:alert(1)",
      "atelier",
    ])
      expect(() => signInReturn(url)).toThrow("Invalid redirectTo");
  });
});
