export type LegalLanguage = "en" | "ro";

export type LegalPageKey = "cookies" | "delivery" | "privacy" | "returns" | "terms";

export interface LegalPageInfo {
  description: string;
  path: string;
  title: string;
}
