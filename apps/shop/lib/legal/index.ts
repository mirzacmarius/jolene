import type { Metadata } from "next";

import { buildOpenGraph } from "@/lib/seo";

import type { LegalLanguage, LegalPageInfo, LegalPageKey } from "./types";

// TODO(mirzacmarius): add the registered office's street before launch.
export const COMPANY = {
  email: "invitatii.jolene@gmail.com",
  name: "Jolene Design SRL",
  phone: "0754 536 366",
  phoneHref: "tel:+40754536366",
  phoneInternational: "+40 754 536 366",
  registeredOffice: "Aroneanu, județul Iași",
  taxId: "49475720",
  tradeRegister: "J22/291/2024",
  vatId: "RO49475720",
  workshop: "Str. Ion Creangă nr. 41, Iași",
} as const;

// The Romanian addresses are jolene.ro's, so its links keep working once jolene.ro points here.
export const LEGAL_PAGES: Record<LegalPageKey, Record<LegalLanguage, LegalPageInfo>> = {
  cookies: {
    en: {
      description:
        "The cookies and browser storage Jolene's shop, studio and digital invitations use.",
      path: "/en/cookie-policy",
      title: "Cookie policy",
    },
    ro: {
      description:
        "Cookie-urile și datele salvate în browser pe care le folosesc magazinul, studioul și invitațiile digitale Jolene.",
      path: "/politica-de-cookies",
      title: "Politica de cookies",
    },
  },
  delivery: {
    en: {
      description:
        "How to order from Jolene, how to pay, when your order arrives and what delivery costs.",
      path: "/en/ordering-and-delivery",
      title: "Ordering, payment and delivery",
    },
    ro: {
      description:
        "Cum comandați de la Jolene, cum plătiți, în cât timp ajunge comanda și cât costă livrarea.",
      path: "/politica-de-comanda-si-livrare",
      title: "Comandă, plată și livrare",
    },
  },
  privacy: {
    en: {
      description:
        "What personal data Jolene keeps about couples and their guests, why, for how long, and your rights.",
      path: "/en/privacy-policy",
      title: "Privacy policy",
    },
    ro: {
      description:
        "Ce date personale păstrează Jolene despre miri și invitații lor, de ce, cât timp și ce drepturi aveți.",
      path: "/politica-de-confidentialitate",
      title: "Politica de confidențialitate",
    },
  },
  returns: {
    en: {
      description:
        "Returns, the right of withdrawal for personalised stationery and the digital invitation, and what happens when something is wrong.",
      path: "/en/returns",
      title: "Returns and the right of withdrawal",
    },
    ro: {
      description:
        "Retururile, dreptul de retragere pentru papetăria personalizată și invitația digitală, și ce facem când ceva nu e în regulă.",
      path: "/politica-de-retur",
      title: "Politica de retur",
    },
  },
  terms: {
    en: {
      description:
        "The terms for using Jolene's shop, studio and digital invitations, and for ordering.",
      path: "/en/terms-and-conditions",
      title: "Terms and conditions",
    },
    ro: {
      description:
        "Termenii în care folosiți magazinul, studioul și invitațiile digitale Jolene și în care comandați.",
      path: "/termeni-si-conditii",
      title: "Termeni și condiții",
    },
  },
};

export const LEGAL_PAGE_ORDER: readonly LegalPageKey[] = [
  "terms",
  "delivery",
  "returns",
  "privacy",
  "cookies",
];

const UPDATED_AT = new Date("2026-10-24T00:00:00Z");

export function formatUpdatedAt(language: LegalLanguage): string {
  return new Intl.DateTimeFormat(language === "ro" ? "ro-RO" : "en-GB", {
    dateStyle: "long",
    timeZone: "UTC",
  }).format(UPDATED_AT);
}

export function getLegalMetadata(page: LegalPageKey, language: LegalLanguage): Metadata {
  const { description, path, title } = LEGAL_PAGES[page][language];
  return {
    alternates: {
      canonical: path,
      languages: {
        en: LEGAL_PAGES[page].en.path,
        ro: LEGAL_PAGES[page].ro.path,
        "x-default": LEGAL_PAGES[page].ro.path,
      },
    },
    description,
    openGraph: buildOpenGraph({ description, title, url: path }),
    title,
  };
}
