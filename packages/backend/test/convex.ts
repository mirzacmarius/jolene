import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { Glob } from "bun";
import type { SchemaDefinition } from "convex/server";
import { convexTest } from "convex-test";
import schema from "../convex/schema";

/**
 * A test deployment of the backend for convex-test, with the components
 * its functions call. Each component's functions load from its sources, as
 * Vite's import.meta.glob would list them in its own tests.
 */

function modulesIn(dir: string) {
  return Object.fromEntries(
    [...new Glob("**/*.ts").scanSync(dir)]
      .filter((path) => !path.endsWith(".test.ts"))
      .map((path) => [`./${path}`, () => import(join(dir, path))]),
  );
}

/** The functions of the app, from convex/. */
export const modules = modulesIn(join(import.meta.dir, "../convex"));

/** A component package's source folder, found from `from`'s dependencies. */
function componentDir(from: string, name: string) {
  const require = createRequire(from);
  return join(
    dirname(require.resolve(`${name}/package.json`)),
    "src/component",
  );
}

async function component(dir: string) {
  const { default: componentSchema } = (await import(
    join(dir, "schema.ts")
  )) as {
    default: SchemaDefinition<never, boolean>;
  };
  return { schema: componentSchema, modules: modulesIn(dir) };
}

const rateLimiterDir = componentDir(
  import.meta.path,
  "@convex-dev/rate-limiter",
);
const rateLimiter = await component(rateLimiterDir);
const batchWorker = await component(
  componentDir(
    join(rateLimiterDir, "../package.json"),
    "@convex-dev/batch-worker",
  ),
);

/**
 * A fresh test deployment, with the rate limiter the app's functions use.
 * `replacing` loads some of the app's modules another way, by their path,
 * such as "./auth.ts".
 */
export function testConvex(
  replacing: Record<string, () => Promise<unknown>> = {},
) {
  const t = convexTest(schema, { ...modules, ...replacing });
  t.registerComponent("rateLimiter", rateLimiter.schema, rateLimiter.modules);
  t.registerComponent(
    "rateLimiter/batchWorker",
    batchWorker.schema,
    batchWorker.modules,
  );
  return t;
}
