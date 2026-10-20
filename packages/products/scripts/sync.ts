/**
 * Puts the catalog in Shopify, as .github/workflows/products.yml runs it:
 *
 *   bun scripts/sync.ts plan|draft|publish --schema <file> [--out <folder>]
 *     [--publication <ID or name>] [--overwrite]
 *
 * --schema is the Admin API's schema as an introspection result, such as
 * dist/data/admin_2026-10.json.gz in @shopify/dev-mcp. The store comes
 * from SHOPIFY_STORE_DOMAIN, SHOPIFY_CLIENT_ID and SHOPIFY_CLIENT_SECRET;
 * without them a plan only checks its calls.
 */
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { parseArgs } from "node:util";
import { readCatalog } from "../src/files";
import { Admin } from "../src/shopify/admin";
import { Checker, readSchema } from "../src/shopify/schema";
import { type Mode, sync } from "../src/shopify/sync";

const { positionals, values } = parseArgs({
  allowPositionals: true,
  options: {
    schema: { type: "string" },
    out: { type: "string", default: "out" },
    publication: { type: "string" },
    overwrite: { type: "boolean", default: false },
  },
});
const mode = positionals[0] as Mode;
if (!["plan", "draft", "publish"].includes(mode) || !values.schema) {
  console.error(
    "Usage: bun scripts/sync.ts plan|draft|publish --schema <file> [--out <folder>] [--publication <ID or name>] [--overwrite]",
  );
  process.exit(2);
}

const domain = process.env.SHOPIFY_STORE_DOMAIN;
const clientId = process.env.SHOPIFY_CLIENT_ID;
const clientSecret = process.env.SHOPIFY_CLIENT_SECRET;
if (mode !== "plan" && !(domain && clientId && clientSecret)) {
  console.error(
    "A draft or publish run needs SHOPIFY_STORE_DOMAIN, SHOPIFY_CLIENT_ID and SHOPIFY_CLIENT_SECRET.",
  );
  process.exit(2);
}

await mkdir(values.out, { recursive: true });
let store: Admin | undefined;
if (domain && clientId && clientSecret)
  try {
    store = await Admin.connect({ domain, clientId, clientSecret });
  } catch (error) {
    const refused = error instanceof Error ? error.message : String(error);
    console.error(refused);
    await Bun.write(
      join(values.out, "report.md"),
      `# Products: ${mode}\n\n${refused}\n`,
    );
    process.exit(1);
  }

const outcome = await sync({
  catalog: await readCatalog(),
  checker: new Checker(await readSchema(values.schema)),
  mode,
  store,
  publication: values.publication,
  overwrite: values.overwrite,
  log: (line) => console.log(line),
});

await Bun.write(join(values.out, "report.md"), outcome.report);
process.exit(outcome.problems.length > 0 ? 1 : 0);
