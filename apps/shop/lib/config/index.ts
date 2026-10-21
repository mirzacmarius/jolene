import type { ShopConfig } from "./types";

const defaultUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL
  ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
  : "http://localhost:3000";

export const shopConfig = {
  analytics: {
    speedInsights: {
      isEnabled: false,
    },
    vercel: {
      isEnabled: false,
    },
  },
  localization: {
    locale: "ro-RO" as const,
  },
  search: {
    isEnabled: true,
  },
  site: {
    description:
      "Invitații de nuntă și botez, meniuri, place carduri și mărturii, personalizate în studioul Jolene și tipărite în atelierul nostru.",
    name: "Jolene",
    url: defaultUrl,
  },
} satisfies ShopConfig;
