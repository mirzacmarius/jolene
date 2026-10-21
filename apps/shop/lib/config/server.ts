import {
  PHASE_DEVELOPMENT_SERVER,
  PHASE_PRODUCTION_BUILD,
  PHASE_PRODUCTION_SERVER,
} from "next/constants";

import type {
  NextConfigContext,
  NextConfigFactory,
  NextConfigInput,
  NextConfigPlugin,
} from "./types";

function assertRequiredEnv(phase: string) {
  if (![PHASE_DEVELOPMENT_SERVER, PHASE_PRODUCTION_BUILD, PHASE_PRODUCTION_SERVER].includes(phase))
    return;
  // Next typegen uses the production-build phase but reads no catalog.
  if (process.argv.includes("typegen")) return;

  const missing = ["NEXT_PUBLIC_CONVEX_URL"].filter((key) => !process.env[key]);
  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(", ")}. See .env.example.`,
    );
  }
}

async function resolveConfig(config: NextConfigInput, phase: string, context: NextConfigContext) {
  return typeof config === "function" ? config(phase, context) : config;
}

export function withShopConfig(
  nextConfig: NextConfigInput,
  plugins: readonly (NextConfigPlugin | false | null | undefined)[] = [],
): NextConfigFactory {
  return async (phase, context) => {
    assertRequiredEnv(phase);

    let config = await resolveConfig(nextConfig, phase, context);
    for (const plugin of plugins) {
      if (plugin) config = await resolveConfig(await plugin(config), phase, context);
    }
    return config;
  };
}
