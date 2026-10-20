"use client";

import { api } from "@jolene/backend/convex/_generated/api";
import type { Id } from "@jolene/backend/convex/_generated/dataModel";
import {
  type DesignCheck,
  type DesignDocument,
  type FaceName,
  faceNames,
  fieldsFor,
  type PrintIssue,
  productKindLabels,
  type TextLayout,
} from "@jolene/design";
import { Button } from "@jolene/ui/button";
import { Logo } from "@jolene/ui/logo";
import { Skeleton } from "@jolene/ui/skeleton";
import { toast } from "@jolene/ui/toaster";
import { useAction, useConvexAuth, useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import {
  ChevronLeft,
  CircleAlert,
  CircleCheck,
  LoaderCircle,
} from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { useCurrentLocale, useI18n } from "@/locales/client";
import { DesignPreview } from "../design/design-preview";
import { canvasBlob, renderCanvas } from "../design/render-image";
import { useProofCheck } from "./use-proof-check";

/** Where a couple writes to order an item the shop doesn't sell online yet. */
const JOLENE_EMAIL = "invitatii.jolene@gmail.com";

/** The long side of the proof's picture for the order, in pixels. */
const PICTURE_LONG_SIDE = 1200;

/** How long the order waits for the proof's picture before going without. */
const PICTURE_WAIT_MS = 10_000;

/** How much of a line an issue quotes. */
const EXCERPT_LENGTH = 40;

type DesignData = NonNullable<FunctionReturnType<typeof api.designs.get>>;

/** "Invitația (față)": where on the item something is. */
type PlaceOf = (piece: string, face: FaceName) => string;

/** The proof of the design named in the URL, for the couple who owns it. */
export function ProofView() {
  const t = useI18n();
  const { id } = useParams<{ id: string }>();
  const { isLoading } = useConvexAuth();
  const data = useQuery(api.designs.get, isLoading ? "skip" : { designId: id });
  if (data === undefined) return <ProofSkeleton />;
  if (data === null)
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-6 px-4 text-center">
        <Logo />
        <p className="max-w-sm text-muted-foreground">{t("design.notFound")}</p>
        <Button asChild variant="outline">
          <Link href="/studio">{t("common.collections")}</Link>
        </Button>
      </div>
    );
  return <Proof key={data.design._id} data={data} />;
}

/**
 * Every face of the design, flat and exactly as it prints with the couple's
 * own details (no examples), beside what to look at and the approval.
 */
function Proof({ data }: { data: DesignData }) {
  const t = useI18n();
  const locale = useCurrentLocale();
  const document = data.design.document as DesignDocument;
  const fields = data.event.fields;
  const check = useProofCheck(document, fields, data.assets);
  const [guides, setGuides] = useState(false);
  const title = `${productKindLabels[document.kind][locale]} · ${data.template.suite.name[locale]}`;
  const faces = document.pieces.flatMap((piece) =>
    faceNames.filter((face) => piece[face]).map((face) => ({ piece, face })),
  );
  const placeOf: PlaceOf = (pieceId, face) => {
    const piece = document.pieces.find((each) => each.id === pieceId);
    return t("proof.place", {
      piece: piece?.name ?? pieceId,
      side: face === "back" ? t("proof.backSide") : t("proof.front"),
    });
  };

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="flex h-14 shrink-0 items-center gap-3 border-b border-border/70 bg-background px-3 sm:px-4">
        <Button asChild variant="ghost" size="sm" className="gap-1 px-2.5">
          <Link href={`/studio/design/${data.design._id}`}>
            <ChevronLeft aria-hidden />
            <span className="hidden sm:inline">{t("proof.back")}</span>
          </Link>
        </Button>
        <h1 className="truncate font-display text-xl">{t("proof.title")}</h1>
        <span className="hidden truncate text-sm text-muted-foreground sm:inline">
          {title}
        </span>
      </header>

      <div className="flex flex-1 flex-col lg:flex-row">
        <main className="min-w-0 flex-1 bg-[radial-gradient(80%_70%_at_50%_45%,var(--color-card),var(--color-secondary))] px-4 py-5 sm:px-8">
          <label className="flex items-center justify-end gap-2 text-xs text-muted-foreground">
            <input
              type="checkbox"
              checked={guides}
              onChange={(event) => setGuides(event.target.checked)}
              className="size-3.5 accent-[var(--color-primary)]"
            />
            {t("design.guides")}
          </label>
          <ul className="mt-4 space-y-10">
            {faces.map(({ piece, face }) => {
              const place = placeOf(piece.id, face);
              return (
                <li key={`${piece.id}:${face}`}>
                  <figure
                    className="mx-auto"
                    // As wide as fits, and no taller than most of the screen.
                    style={{
                      width: `min(100%, calc(75dvh * ${piece.width} / ${piece.height}))`,
                    }}
                  >
                    <DesignPreview
                      document={document}
                      fields={fields}
                      assets={data.assets}
                      view={{ kind: "face", piece: piece.id, face, guides }}
                      title={place}
                      className="shadow-[0_1px_2px_rgb(0_0_0/0.08),0_14px_32px_-14px_rgb(0_0_0/0.3)]"
                    />
                    <figcaption className="mt-3 text-center text-sm text-muted-foreground">
                      {place}
                    </figcaption>
                  </figure>
                </li>
              );
            })}
          </ul>
        </main>

        <aside className="w-full shrink-0 border-border/70 bg-card px-5 py-6 lg:sticky lg:top-0 lg:h-dvh lg:w-[380px] lg:overflow-y-auto lg:border-l">
          <h2 className="font-display text-2xl">{t("proof.heading")}</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            {t("proof.lead")}
          </p>
          <Issues check={check} document={document} placeOf={placeOf} />
          <Approval data={data} />
        </aside>
      </div>
    </div>
  );
}

/** A line's words as an issue quotes them. */
function excerpt(layout: TextLayout | undefined) {
  const text = layout?.lines.map((line) => line.text.trim()).join(" ") ?? "";
  return text.length > EXCERPT_LENGTH
    ? `${text.slice(0, EXCERPT_LENGTH).trimEnd()}…`
    : text;
}

function issueKey(issue: PrintIssue) {
  return "layer" in issue
    ? `${issue.kind}:${issue.piece}:${issue.face}:${issue.layer}`
    : issue.kind;
}

/** What the checks found, in the couple's words; or that nothing needs them. */
function Issues({
  check,
  document,
  placeOf,
}: {
  check: DesignCheck | undefined;
  document: DesignDocument;
  placeOf: PlaceOf;
}) {
  const t = useI18n();
  const locale = useCurrentLocale();
  if (!check)
    return (
      <p className="mt-6 flex items-center gap-2 text-sm text-muted-foreground">
        <LoaderCircle className="size-4 animate-spin" aria-hidden />
        {t("proof.checking")}
      </p>
    );
  if (check.issues.length === 0)
    return (
      <p className="mt-6 flex items-start gap-2 text-sm">
        <CircleCheck
          className="mt-0.5 size-4 shrink-0 text-primary"
          aria-hidden
        />
        {t("proof.clear")}
      </p>
    );
  const labels = fieldsFor(document.occasion);
  const describe = (issue: PrintIssue) => {
    switch (issue.kind) {
      case "missing-details":
        return t("proof.missingDetails", {
          fields: issue.fields
            .map((key) => labels[key]?.labels[locale] ?? key)
            .join(", "),
        });
      case "overflow":
        return t("proof.overflow", {
          text: excerpt(check.layouts[issue.layer]),
          place: placeOf(issue.piece, issue.face),
        });
      case "outside-safe-area":
        return t("proof.outsideSafeArea", {
          text: excerpt(check.layouts[issue.layer]),
          place: placeOf(issue.piece, issue.face),
        });
      case "missing-photo":
        return t("proof.missingPhoto", {
          place: placeOf(issue.piece, issue.face),
        });
      case "missing-artwork":
        return t("proof.missingArtwork", {
          place: placeOf(issue.piece, issue.face),
        });
      case "low-resolution":
        return t("proof.lowResolution", {
          dpi: issue.dpi,
          place: placeOf(issue.piece, issue.face),
        });
      case "missing-glyphs":
      case "unusual-characters":
        return t("proof.unusualCharacters", {
          characters: issue.characters,
          place: placeOf(issue.piece, issue.face),
        });
    }
  };
  return (
    <section className="mt-6">
      <h3 className="text-sm font-medium">{t("proof.toCheck")}</h3>
      <ul className="mt-3 space-y-3">
        {check.issues.map((issue) => (
          <li key={issueKey(issue)} className="flex items-start gap-2 text-sm">
            <CircleAlert
              className="mt-0.5 size-4 shrink-0 text-gold"
              aria-hidden
            />
            <span>{describe(issue)}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

/**
 * Whether the shop sells an item, which is whether its product has a page:
 * the shop answers each product page in Markdown too, at its address with
 * ".md". Undefined while the shop is asked.
 */
function useShopSells(handle: string | null) {
  const [answer, setAnswer] = useState<{ handle: string; sells: boolean }>();
  useEffect(() => {
    if (!handle) return;
    let live = true;
    fetch(`/products/${encodeURIComponent(handle)}.md`)
      .then((response) => response.ok)
      .catch(() => false)
      .then((sells) => {
        if (live) setAnswer({ handle, sells });
      });
    return () => {
      live = false;
    };
  }, [handle]);
  if (!handle) return false;
  return answer?.handle === handle ? answer.sells : undefined;
}

/**
 * The couple's approval: the design as it is now, with their details. Once
 * approved, the shop takes the order with the proof; an item the shop
 * doesn't sell yet is ordered by writing to Jolene.
 */
function Approval({ data }: { data: DesignData }) {
  const t = useI18n();
  const locale = useCurrentLocale();
  const designId = data.design._id;
  const latest = useQuery(api.proofs.latest, { designId });
  const sells = useShopSells(latest?.current ? latest.product : null);
  const approve = useMutation(api.proofs.approve);
  const attachImage = useAction(api.proofs.attachImage);
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState<"approving" | "preparing">();
  const formatDate = (time: number) =>
    new Intl.DateTimeFormat(locale === "ro" ? "ro-RO" : "en-GB", {
      dateStyle: "long",
      timeStyle: "short",
    }).format(time);

  // The picture shows the order in the cart and to the workshop. The proof
  // stands without it, so a failed or slow upload doesn't hold up the order.
  const keepPicture = async (proofId: Id<"proofs">) => {
    const upload = (async () => {
      const canvas = await renderCanvas({
        design: data.design.document as DesignDocument,
        fields: data.event.fields,
        assets: data.assets,
        view: { kind: "assembly" },
        longSide: PICTURE_LONG_SIDE,
      });
      const image = await canvasBlob(canvas, "image/jpeg", 0.9);
      await attachImage({ proofId, image: await image.arrayBuffer() });
    })().catch(() => {});
    await Promise.race([
      upload,
      new Promise((resolve) => setTimeout(resolve, PICTURE_WAIT_MS)),
    ]);
  };

  const onApprove = async () => {
    setBusy("approving");
    try {
      const result = await approve({
        designId,
        revision: data.design.revision,
        fields: data.event.fields,
      });
      if (!result.ok) {
        toast(t("proof.changed"));
        return;
      }
      setBusy("preparing");
      await keepPicture(result.proofId);
      setConfirmed(false);
    } catch {
      toast.error(t("common.error"));
    } finally {
      setBusy(undefined);
    }
  };

  if (latest === undefined) return <Skeleton className="mt-8 h-28" />;

  if (latest?.current)
    return (
      <section className="mt-8 space-y-4 border-t border-border/70 pt-6">
        <p className="flex items-start gap-2 text-sm">
          <CircleCheck
            className="mt-0.5 size-4 shrink-0 text-primary"
            aria-hidden
          />
          {t("proof.approved", { date: formatDate(latest.approvedAt) })}
        </p>
        {busy === "preparing" || sells === undefined ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <LoaderCircle className="size-4 animate-spin" aria-hidden />
            {t("proof.preparing")}
          </p>
        ) : sells && latest.product ? (
          // The shop is another app on this domain: a plain link loads it.
          <Button asChild className="w-full">
            <a href={`/products/${latest.product}?proof=${latest._id}`}>
              {t("proof.order")}
            </a>
          </Button>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">
              {t("proof.notOnline")}
            </p>
            <Button asChild variant="outline" className="w-full">
              <a
                href={`mailto:${JOLENE_EMAIL}?subject=${encodeURIComponent(
                  t("proof.mailSubject", { code: latest._id }),
                )}`}
              >
                {t("proof.write")}
              </a>
            </Button>
          </>
        )}
        <Button asChild variant="ghost" className="w-full">
          <Link href={`/studio/design/${designId}`}>{t("proof.edit")}</Link>
        </Button>
      </section>
    );

  return (
    <section className="mt-8 space-y-4 border-t border-border/70 pt-6">
      {latest ? (
        <p className="text-sm text-muted-foreground">
          {t("proof.earlier", { date: formatDate(latest.approvedAt) })}
        </p>
      ) : null}
      <label className="flex items-start gap-3 text-sm">
        <input
          type="checkbox"
          checked={confirmed}
          onChange={(event) => setConfirmed(event.target.checked)}
          className="mt-0.5 size-4 shrink-0 accent-[var(--color-primary)]"
        />
        {t("proof.confirm")}
      </label>
      <Button
        className="w-full"
        disabled={!confirmed || busy !== undefined}
        onClick={onApprove}
      >
        {busy ? <LoaderCircle className="animate-spin" aria-hidden /> : null}
        {busy ? t("proof.approving") : t("proof.approve")}
      </Button>
    </section>
  );
}

export function ProofSkeleton() {
  return (
    <div className="flex min-h-dvh flex-col">
      <div className="h-14 border-b border-border/70" />
      <div className="flex min-h-0 flex-1">
        <div className="flex flex-1 items-center justify-center bg-secondary/60">
          <Skeleton className="aspect-[3/4] h-2/3 rounded-sm" />
        </div>
        <div className="hidden w-[380px] space-y-4 border-l border-border/70 p-5 lg:block">
          {[0, 1, 2].map((key) => (
            <Skeleton key={key} className="h-14" />
          ))}
        </div>
      </div>
    </div>
  );
}
