"use client";

import {
  eucaliptFields,
  eucaliptInvitation,
  eucaliptSaveTheDate,
  eucalyptusArtwork,
  type Language,
  parseDocument,
  previewFields,
} from "@jolene/design";
import { useCurrentLocale, useI18n } from "@/locales/client";
import { type AssetLink, DesignPreview } from "../design/design-preview";

const invitation = parseDocument(eucaliptInvitation);
const saveTheDate = parseDocument(eucaliptSaveTheDate);

// Drawn inline, so the welcome page shows a finished invitation before (and
// without) anything loading from the backend.
const assets: AssetLink[] = [
  {
    key: eucalyptusArtwork.key,
    url: `data:image/svg+xml;utf8,${encodeURIComponent(eucalyptusArtwork.svg)}`,
    recolorable: true,
  },
];

const notes = [
  { key: "foil", className: "-left-[3%] top-[49%]" },
  { key: "vellum", className: "left-[63%] top-[80%]" },
  { key: "seal", className: "left-[1%] top-[89%]" },
] as const;

/** The Eucalipt invitation over its save-the-date, as the welcome picture. */
export function HeroPreview() {
  const t = useI18n();
  const language: Language = useCurrentLocale();
  const fields = previewFields("wedding", language, eucaliptFields);
  return (
    <div className="relative mx-auto aspect-[5/6] w-full max-w-[560px]">
      <div
        aria-hidden
        className="absolute inset-[6%] rounded-full bg-[radial-gradient(closest-side,color-mix(in_oklab,var(--color-blush)_70%,transparent),transparent)] blur-2xl"
      />
      <div className="absolute right-0 top-[2%] w-[56%] rotate-[7deg] transition-transform duration-700 hover:rotate-[4deg]">
        <DesignPreview
          document={saveTheDate}
          fields={fields}
          assets={assets}
          title={t("home.previewSaveTheDate")}
        />
      </div>
      <div className="absolute bottom-0 left-[4%] w-[66%] -rotate-[3deg] transition-transform duration-700 hover:-rotate-1">
        <DesignPreview
          document={invitation}
          fields={fields}
          assets={assets}
          title={t("home.previewInvitation")}
        />
      </div>
      {notes.map((note) => (
        <span
          key={note.key}
          className={`absolute ${note.className} hidden rounded-full border border-border/80 bg-card/90 px-3 py-1.5 text-xs font-medium tracking-wide text-foreground shadow-sm backdrop-blur sm:inline-flex`}
        >
          {t(`home.note.${note.key}`)}
        </span>
      ))}
    </div>
  );
}
