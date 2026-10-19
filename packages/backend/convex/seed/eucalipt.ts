import {
  eucaliptFields,
  eucaliptInvitation,
  eucaliptMenu,
  eucaliptPlaceCard,
  eucaliptSaveTheDate,
} from "@jolene/design";

/**
 * The suite every new deployment starts with, so the studio has something to
 * show before Jolene's own designs are imported.
 */
export const eucalipt = {
  slug: "eucalipt",
  name: { ro: "Eucalipt", en: "Eucalyptus" },
  description: {
    ro: "Ramuri de eucalipt, nume în folio auriu și o banderolă din foaie de calc sigilată cu ceară.",
    en: "Eucalyptus sprigs, gold-foil names and a vellum band closed with a wax seal.",
  },
  occasion: "wedding",
  styles: ["botanic", "vellum", "wax-seal", "gold-foil"],
  sampleFields: eucaliptFields as Record<string, string>,
  templates: [
    { slug: "eucalipt-invitatie", document: eucaliptInvitation },
    { slug: "eucalipt-save-the-date", document: eucaliptSaveTheDate },
    { slug: "eucalipt-meniu", document: eucaliptMenu },
    { slug: "eucalipt-place-card", document: eucaliptPlaceCard },
  ],
} as const;
