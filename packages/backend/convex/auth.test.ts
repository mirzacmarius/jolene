import { afterEach, beforeEach, describe, expect, spyOn, test } from "bun:test";
import { httpRouter } from "convex/server";
import { decodeJwt, exportJWK, exportPKCS8, generateKeyPair } from "jose";
import { testConvex } from "../test/convex";
import { fakeGoogle, GOOGLE, type GoogleAccount } from "../test/google";
import { api } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { studioPage } from "./auth";

/** The OAuth client the tests' Google knows. */
const CLIENT_ID = "jolene-test.apps.googleusercontent.com";

/** Where the workshop's sign-in starts and comes back to. */
const WORKSHOP = "https://www.orvibo.it/studio/atelier?signin=google";

/** The environment the tests sign in with, set before each and cleared. */
const authEnv = {
  // As production has them: the studio's own Vercel address, and the
  // shop's, where microfrontends serve the studio at /studio.
  SITE_URL: "https://jolene-studio.vercel.app/studio",
  SHOP_URL: "https://www.orvibo.it",
  CONVEX_SITE_URL: "https://jolene-test.convex.site",
  WORKSHOP_EMAILS: " Atelier@Jolene.ro, marius@example.com",
  AUTH_GOOGLE_ID: CLIENT_ID,
  AUTH_GOOGLE_SECRET: "GOCSPX-test-secret",
};

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
  Object.assign(process.env, authEnv, keys);
});

afterEach(() => {
  for (const name of [...Object.keys(authEnv), ...Object.keys(keys)])
    Reflect.deleteProperty(process.env, name);
});

/**
 * Convex Auth reads AUTH_GOOGLE_ID and AUTH_GOOGLE_SECRET as auth.ts loads,
 * and test files share one copy of each module, which may have loaded
 * without them. These tests sign in through a copy of their own, loaded
 * while they're set, and the routes it adds to http.ts.
 */
const OWN_AUTH = "./auth.ts?google";
const ownAuth = () => import(OWN_AUTH) as Promise<typeof import("./auth")>;

/** A test deployment, and visitors signed in to it. */
function setUp() {
  const t = testConvex({
    "./auth.ts": ownAuth,
    "./http.ts": async () => {
      const http = httpRouter();
      (await ownAuth()).auth.addHttpRoutes(http);
      return { default: http };
    },
  });
  /** A visitor with a session, as Convex Auth signs them in. */
  const visit = async (user: {
    email?: string;
    emailVerificationTime?: number;
    isAnonymous?: boolean;
  }) => {
    const userId = await t.run((ctx) => ctx.db.insert("users", user));
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
  return { t, visit };
}

/**
 * Signs in with Google as the studio does: Convex Auth sends the browser to
 * Google, Google sends it back to Convex Auth with its code, and Convex Auth
 * sends it on to the studio's page with a code of its own, which the page
 * trades for the account's session with the verifier it kept.
 */
async function signInWithGoogle(
  t: ReturnType<typeof setUp>["t"],
  as: ReturnType<ReturnType<typeof setUp>["t"]["withIdentity"]>,
) {
  const started = await as.action(api.auth.signIn, {
    provider: "google",
    params: { redirectTo: WORKSHOP },
  });
  const start = new URL(started.redirect as string);
  const toGoogle = await t.fetch(`${start.pathname}${start.search}`);
  const cookie = toGoogle.headers
    .getSetCookie()
    .map((line) => line.split(";")[0])
    .join("; ");
  const google = new URL(toGoogle.headers.get("location") as string);
  const fromGoogle = new URLSearchParams({
    code: "4/0AVGzR1test",
    scope: "email openid https://www.googleapis.com/auth/userinfo.email",
    authuser: "0",
    prompt: "consent",
  });
  const back = await t.fetch(`/api/auth/callback/google?${fromGoogle}`, {
    headers: { cookie },
  });
  const page = new URL(back.headers.get("location") as string);
  const code = page.searchParams.get("code");
  const signedIn = code
    ? await as.action(api.auth.signIn, {
        params: { code },
        verifier: started.verifier,
      })
    : null;
  const token = signedIn?.tokens?.token;
  return {
    google,
    page,
    /** Whoever the session the page got is for, as Convex Auth names them. */
    subject: token ? (decodeJwt(token).sub as string) : null,
  };
}

describe("signing in with Google", () => {
  test("lets the workshop's team in, with what they made in the browser", async () => {
    const { t, visit } = setUp();
    const anonymous = await visit({ isAnonymous: true });
    const eventId = await t.run((ctx) =>
      ctx.db.insert("events", {
        ownerId: anonymous.userId,
        occasion: "wedding",
        fields: {},
        updatedAt: Date.now(),
      }),
    );
    const google = await fakeGoogle(
      { sub: "112233", email: "atelier@jolene.ro", email_verified: true },
      CLIENT_ID,
    );
    try {
      const {
        google: asked,
        page,
        subject,
      } = await signInWithGoogle(t, anonymous.as);
      // Google is asked for the address alone, by this deployment's client,
      // with the account chooser shown.
      expect(`${asked.origin}${asked.pathname}`).toBe(
        GOOGLE.authorization_endpoint,
      );
      expect(Object.fromEntries(asked.searchParams)).toMatchObject({
        client_id: CLIENT_ID,
        redirect_uri:
          "https://jolene-test.convex.site/api/auth/callback/google",
        response_type: "code",
        scope: "openid email",
        prompt: "select_account",
        code_challenge_method: "S256",
      });
      expect(google.tokenRequests[0]?.get("code")).toBe("4/0AVGzR1test");
      // Back to the page it started from, on the shop's address.
      expect(page.searchParams.get("code")).toMatch(/^\d{8}$/);
      page.searchParams.delete("code");
      expect(page.href).toBe(WORKSHOP);

      const userId = subject?.split("|")[0] as Id<"users">;
      const account = await t.run((ctx) => ctx.db.get("users", userId));
      expect(account).toMatchObject({ email: "atelier@jolene.ro" });
      expect(account?.emailVerificationTime).toBeNumber();
      expect(account?.isAnonymous).toBeUndefined();
      // Nothing of Google's but the address.
      expect(account?.name).toBeUndefined();
      expect(account?.image).toBeUndefined();
      const event = await t.run((ctx) => ctx.db.get("events", eventId));
      expect(event?.ownerId).toBe(userId);

      const team = t.withIdentity({ subject: subject as string });
      expect(await team.query(api.workshop.access, {})).toEqual({
        signedIn: true,
        email: "atelier@jolene.ro",
        allowed: true,
      });
    } finally {
      google.restore();
    }
  });

  test("finds the account a code opened for the same address", async () => {
    const { t, visit } = setUp();
    const coded = await visit({
      email: "marius@example.com",
      emailVerificationTime: 1,
    });
    const google = await fakeGoogle(
      { sub: "445566", email: "Marius@Example.com", email_verified: true },
      CLIENT_ID,
    );
    try {
      const anonymous = await visit({ isAnonymous: true });
      const { subject } = await signInWithGoogle(t, anonymous.as);
      expect(subject?.split("|")[0]).toBe(coded.userId);
      const accounts = await t.run((ctx) =>
        ctx.db
          .query("authAccounts")
          .withIndex("userIdAndProvider", (q) =>
            q.eq("userId", coded.userId).eq("provider", "google"),
          )
          .collect(),
      );
      expect(accounts.map((account) => account.providerAccountId)).toEqual([
        "445566",
      ]);
    } finally {
      google.restore();
    }
  });

  const refused: [string, GoogleAccount][] = [
    [
      "an address not on the workshop's list",
      { sub: "778899", email: "ana@gmail.com", email_verified: true },
    ],
    [
      "an address Google hasn't verified",
      { sub: "112233", email: "atelier@jolene.ro", email_verified: false },
    ],
  ];
  for (const [what, account] of refused) {
    test(`sends ${what} back signed out`, async () => {
      const { t, visit } = setUp();
      const anonymous = await visit({ isAnonymous: true });
      const google = await fakeGoogle(account, CLIENT_ID);
      const logged = spyOn(console, "error").mockImplementation(() => {});
      try {
        const { page, subject } = await signInWithGoogle(t, anonymous.as);
        // Back where it started, with no code to sign in with.
        expect(page.href).toBe(WORKSHOP);
        expect(subject).toBeNull();
        expect(logged).toHaveBeenCalled();
        const users = await t.run((ctx) => ctx.db.query("users").collect());
        expect(users.map((user) => user._id)).toEqual([anonymous.userId]);
        expect(
          await t.run((ctx) => ctx.db.query("authAccounts").collect()),
        ).toEqual([]);
      } finally {
        logged.mockRestore();
        google.restore();
      }
    });
  }

  test("is offered once its client is set", async () => {
    const { t, visit } = setUp();
    const anonymous = await visit({ isAnonymous: true });
    expect(await anonymous.as.query(api.accounts.me, {})).toMatchObject({
      googleSignIn: true,
    });
    Reflect.deleteProperty(process.env, "AUTH_GOOGLE_SECRET");
    expect(await t.query(api.accounts.me, {})).toMatchObject({
      googleSignIn: false,
    });
  });
});

describe("a sign-in", () => {
  test("comes back to the studio's pages on its addresses", () => {
    Object.assign(process.env, authEnv);
    expect(studioPage(WORKSHOP)).toBe(WORKSHOP);
    expect(studioPage("https://jolene-studio.vercel.app/studio")).toBe(
      "https://jolene-studio.vercel.app/studio",
    );
    expect(studioPage("/atelier/J1001")).toBe(
      "https://jolene-studio.vercel.app/studio/atelier/J1001",
    );
    for (const elsewhere of [
      "https://www.orvibo.it/products/invitatie",
      "https://www.orvibo.it/studios",
      "https://www.orvibo.it.example.com/studio/atelier",
      "https://example.com/studio/atelier",
      "http://www.orvibo.it/studio/atelier",
      "javascript:alert(1)",
      "atelier",
    ])
      expect(() => studioPage(elsewhere)).toThrow();
  });
});
