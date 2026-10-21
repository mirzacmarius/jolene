import type { NextConfig } from "next";

export interface NextConfigContext {
  defaultConfig: NextConfig;
}

export type NextConfigFactory = (
  phase: string,
  context: NextConfigContext,
) => NextConfig | Promise<NextConfig>;

export type NextConfigInput = NextConfig | NextConfigFactory;

export type NextConfigPlugin = (config: NextConfig) => NextConfigInput | Promise<NextConfigInput>;

export interface ShopConfig {
  analytics: {
    speedInsights: {
      isEnabled: boolean;
    };
    vercel: {
      isEnabled: boolean;
    };
  };
  localization: {
    locale: string;
  };
  search: {
    isEnabled: boolean;
  };
  site: {
    description: string;
    name: string;
    url: string;
  };
}
