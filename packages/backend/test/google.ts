/**
 * A stand-in for Google's sign-in in tests, with one account signed in: it
 * serves Google's OpenID configuration and keys, and gives that account's ID
 * token for any code. Other hosts go to whatever fetch was there before.
 */
import { exportJWK, generateKeyPair, SignJWT } from "jose";

/** Google's OpenID configuration, as accounts.google.com serves it. */
export const GOOGLE = {
  issuer: "https://accounts.google.com",
  authorization_endpoint: "https://accounts.google.com/o/oauth2/v2/auth",
  token_endpoint: "https://oauth2.googleapis.com/token",
  userinfo_endpoint: "https://openidconnect.googleapis.com/v1/userinfo",
  jwks_uri: "https://www.googleapis.com/oauth2/v3/certs",
  response_types_supported: ["code", "token", "id_token"],
  subject_types_supported: ["public"],
  id_token_signing_alg_values_supported: ["RS256"],
  scopes_supported: ["openid", "email", "profile"],
  token_endpoint_auth_methods_supported: [
    "client_secret_post",
    "client_secret_basic",
  ],
  code_challenge_methods_supported: ["plain", "S256"],
};

/** The Google account signed in, as its ID token describes it. */
export interface GoogleAccount {
  sub: string;
  email: string;
  email_verified: boolean;
}

/** Replaces fetch with a Google that signs in `account` for `clientId`. */
export async function fakeGoogle(account: GoogleAccount, clientId: string) {
  const { privateKey, publicKey } = await generateKeyPair("RS256");
  const key = { ...(await exportJWK(publicKey)), kid: "test", use: "sig" };
  /** The forms sent to Google's token endpoint, each with its code. */
  const tokenRequests: URLSearchParams[] = [];

  // Bun's fetch is a getter, which spyOn can't wrap: swap it, and put it back.
  const previous = globalThis.fetch;
  globalThis.fetch = (async (
    input: string | URL | Request,
    init?: RequestInit,
  ) => {
    const request = new Request(input, init);
    if (request.url === `${GOOGLE.issuer}/.well-known/openid-configuration`)
      return Response.json(GOOGLE);
    if (request.url === GOOGLE.jwks_uri) return Response.json({ keys: [key] });
    if (request.url !== GOOGLE.token_endpoint) return previous(input, init);
    tokenRequests.push(new URLSearchParams(await request.text()));
    const idToken = await new SignJWT({
      email: account.email,
      email_verified: account.email_verified,
    })
      .setProtectedHeader({ alg: "RS256", kid: "test" })
      .setIssuer(GOOGLE.issuer)
      .setAudience(clientId)
      .setSubject(account.sub)
      .setIssuedAt()
      .setExpirationTime("1h")
      .sign(privateKey);
    return Response.json({
      access_token: "ya29.test",
      expires_in: 3599,
      id_token: idToken,
      scope: "openid https://www.googleapis.com/auth/userinfo.email",
      token_type: "Bearer",
    });
  }) as typeof globalThis.fetch;

  return {
    tokenRequests,
    restore() {
      globalThis.fetch = previous;
    },
  };
}
