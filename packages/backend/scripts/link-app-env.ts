// Points the studio and the shop at the deployment `convex dev` configured for
// this package, so `bun dev` connects without copying URLs by hand.
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const backendEnvPath = resolve(import.meta.dir, "../.env.local");

const url = readFileSync(backendEnvPath, "utf8").match(
  /^CONVEX_URL=(.+)$/m,
)?.[1];
if (!url) {
  throw new Error(
    `CONVEX_URL is missing from ${backendEnvPath}. Run \`convex dev --once\` first.`,
  );
}

const line = `NEXT_PUBLIC_CONVEX_URL=${url}`;
const pattern = /^NEXT_PUBLIC_CONVEX_URL=.*$/m;
for (const app of ["studio", "shop"]) {
  const appEnvPath = resolve(
    import.meta.dir,
    `../../../apps/${app}/.env.local`,
  );
  const existingAppEnv = existsSync(appEnvPath)
    ? readFileSync(appEnvPath, "utf8")
    : "";
  const updatedAppEnv = pattern.test(existingAppEnv)
    ? existingAppEnv.replace(pattern, line)
    : `${existingAppEnv}${existingAppEnv && !existingAppEnv.endsWith("\n") ? "\n" : ""}${line}\n`;
  writeFileSync(appEnvPath, updatedAppEnv);
  console.info(`Linked apps/${app} to ${url}`);
}
