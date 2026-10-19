// Generates a fresh signing key pair for Convex Auth and stores it on the
// deployment this package is configured for (or the one in CONVEX_DEPLOY_KEY).
// Usage: bun scripts/set-auth-keys.ts <site-url> [--prod]
// The secrets are passed straight to `convex env set` and never printed.
import { execFileSync } from "node:child_process";
import { exportJWK, exportPKCS8, generateKeyPair } from "jose";

const [siteUrl, ...flags] = process.argv.slice(2);
if (!siteUrl) {
  throw new Error("Usage: bun scripts/set-auth-keys.ts <site-url> [--prod]");
}

const keys = await generateKeyPair("RS256", { extractable: true });
const privateKey = await exportPKCS8(keys.privateKey);
const publicKey = await exportJWK(keys.publicKey);

const variables = {
  JWT_PRIVATE_KEY: privateKey.trimEnd().replace(/\n/g, " "),
  JWKS: JSON.stringify({ keys: [{ use: "sig", ...publicKey }] }),
  SITE_URL: siteUrl,
};

for (const [name, value] of Object.entries(variables)) {
  execFileSync("npx", ["convex", "env", "set", ...flags, name, "--", value], {
    stdio: ["ignore", "ignore", "inherit"],
  });
  console.info(`Set ${name}`);
}
