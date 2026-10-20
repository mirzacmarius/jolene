"use client";

import {
  type DesignDocument,
  parseDocument,
  previewFields,
} from "@jolene/design";
import { forest } from "@jolene/suites";
import { useI18n } from "@/locales/client";
import { type AssetLink, DesignPreview } from "../design/design-preview";

function template(slug: string): DesignDocument {
  const found = forest.templates.find((template) => template.slug === slug);
  if (!found) throw new Error(`Forest has no ${slug}`);
  return parseDocument(found.document);
}

const invitation = template("forest-invitatie");
const rsvp = template("forest-rsvp");
// In the invitation's own language, whichever the visitor reads.
const fields = previewFields(
  "wedding",
  invitation.language,
  forest.sampleFields,
);

// The studio serves Jolene's artwork itself, so the welcome page shows a
// finished invitation before (and without) anything loading from the backend.
const assets: AssetLink[] = Object.entries(forest.art).map(
  ([key, artwork]) => ({
    key,
    url: artwork.path,
    recolorable: artwork.recolorable ?? false,
  }),
);

const notes = [
  { key: "names", className: "-left-[2%] top-[54%]" },
  { key: "details", className: "right-[1%] top-[3%]" },
  { key: "foil", className: "right-[3%] bottom-[25%]" },
] as const;

/**
 * The Forest invitation, its painted front over the back with the details,
 * and its RSVP card, as the welcome picture.
 */
export function HeroPreview() {
  const t = useI18n();
  return (
    <div className="relative mx-auto aspect-[5/6] w-full max-w-[560px]">
      <div
        aria-hidden
        className="absolute inset-[6%] rounded-full bg-[radial-gradient(closest-side,color-mix(in_oklab,var(--color-blush)_70%,transparent),transparent)] blur-2xl"
      />
      <div className="absolute right-[2%] top-[5%] w-[54%] rotate-[6deg] transition-transform duration-700 hover:rotate-[3deg]">
        <DesignPreview
          document={invitation}
          fields={fields}
          assets={assets}
          view={{ kind: "face", piece: "card", face: "back" }}
          title={t("home.previewDetails")}
        />
      </div>
      <div className="absolute bottom-[4%] left-[3%] w-[58%] -rotate-[4deg] transition-transform duration-700 hover:-rotate-2">
        <DesignPreview
          document={invitation}
          fields={fields}
          assets={assets}
          title={t("home.previewInvitation")}
        />
      </div>
      <div className="absolute bottom-0 right-[4%] w-[44%] rotate-[3deg] transition-transform duration-700 hover:rotate-1">
        <DesignPreview
          document={rsvp}
          fields={fields}
          assets={assets}
          title={t("home.previewRsvp")}
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
