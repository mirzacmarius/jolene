"use client";

import { api } from "@jolene/backend/convex/_generated/api";
import type { Id } from "@jolene/backend/convex/_generated/dataModel";
import {
  COURIER_PRICE,
  FREE_DELIVERY_FROM,
} from "@jolene/backend/convex/checkout/delivery";
import { errors } from "@jolene/backend/convex/utils/errors";
import {
  type DesignCheck,
  type DesignDocument,
  type FaceName,
  type Fields,
  faceNames,
  fieldsFor,
  type PrintIssue,
  previewFields,
  productKindLabels,
  type TextLayout,
} from "@jolene/design";
import { Button } from "@jolene/ui/button";
import { DialogDescription, DialogTitle } from "@jolene/ui/dialog";
import { SegmentedControl } from "@jolene/ui/segmented-control";
import { Skeleton } from "@jolene/ui/skeleton";
import { toast } from "@jolene/ui/toaster";
import { cn } from "@jolene/ui/utils";
import { useAction, useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import {
  ArrowRight,
  Check,
  CircleAlert,
  CircleCheck,
  LoaderCircle,
} from "lucide-react";
import Link from "next/link";
import { Fragment, type ReactNode, useMemo, useState } from "react";
import {
  chosenOptions,
  isPaper,
  type Order,
  type OrderedProduct,
  orderOf,
} from "@/lib/finishes";
import { addToCart, JOLENE_EMAIL } from "@/lib/shop";
import { useCurrentLocale, useI18n } from "@/locales/client";
import { type AssetLink, DesignPreview } from "../design/design-preview";
import { canvasBlob, renderCanvas } from "../design/render-image";
import { useStartDesign } from "../design/start-design-button";
import { usePrice } from "../suite/use-price";
import { useAdds } from "../workspace/finishes-panel";
import { useProofCheck } from "./use-proof-check";

/** The long side of the proof's picture for the order, in pixels. */
const PICTURE_LONG_SIDE = 1200;

/** How long the order waits for the proof's picture before going without. */
const PICTURE_WAIT_MS = 10_000;

/** How much of a line an issue quotes. */
const EXCERPT_LENGTH = 40;

/** How many of the collection's other pieces the cart's step suggests. */
const SUGGESTED = 3;

export type DesignData = NonNullable<
  FunctionReturnType<typeof api.designs.get>
>;

/** "Invitația (față)": where on the item something is. */
type PlaceOf = (piece: string, face: FaceName) => string;

/** Ways back to the design: the sheet closes onto it, a page links to it. */
type Back = {
  /** Closes the sheet; a page links to the design instead. */
  onBack?: () => void;
  /** Opens the Finisaje tab, for a pick still to make. */
  onFinishes?: () => void;
};

/**
 * The proof beside the order it makes (ADR 0021): each face of the design,
 * flat and exactly as it prints with the couple's own details (no
 * examples), what the checks found, and what they order at the shop's
 * prices. One tick approves the proof and puts the design in the shop's
 * cart; then the collection's other pieces, which already have the couple's
 * details. An item the shop doesn't sell is ordered by writing to Jolene.
 * It's the design's sheet, or a page of its own.
 */
export function ProofOrder({
  data,
  sheet = false,
  ...back
}: {
  data: DesignData;
  /** In the design's sheet, whose title and description it gives. */
  sheet?: boolean;
} & Back) {
  const t = useI18n();
  const document = data.design.document as DesignDocument;
  const fields = data.event.fields;
  const product = useQuery(api.catalog.product, {
    template: data.template.slug,
  });
  const finishes = data.design.finishes;
  const order = useMemo(
    () => (product ? orderOf(document, product, finishes) : null),
    [document, product, finishes],
  );
  const check = useProofCheck(document, fields, data.assets);
  const [added, setAdded] = useState(false);
  const Title = sheet ? DialogTitle : "h2";
  const Description = sheet ? DialogDescription : "p";
  const placeOf: PlaceOf = (pieceId, face) => {
    const piece = document.pieces.find((each) => each.id === pieceId);
    return t("proof.place", {
      piece: piece?.name ?? pieceId,
      side: face === "back" ? t("proof.backSide") : t("proof.front"),
    });
  };

  if (added && product && order)
    return (
      <InCart
        data={data}
        product={product}
        order={order}
        title={(text) => <Title className={titleClass}>{text}</Title>}
        description={(text) => (
          <Description className="text-sm text-muted-foreground">
            {text}
          </Description>
        )}
        sheet={sheet}
        {...back}
      />
    );

  return (
    <div className="flex flex-col lg:flex-row">
      <ProofFaces
        document={document}
        fields={fields}
        assets={data.assets}
        placeOf={placeOf}
        sheet={sheet}
      />
      <div className="flex min-w-0 flex-1 flex-col gap-5 px-5 py-6 sm:px-9 sm:py-8">
        <div className="flex flex-col gap-2">
          <span className="text-[11px] font-medium uppercase tracking-[0.24em] text-muted-foreground">
            {t("proof.title")}
          </span>
          <Title className={titleClass}>{t("proof.heading")}</Title>
          <Description className="text-sm leading-relaxed text-muted-foreground">
            {t("proof.lead")}
          </Description>
        </div>
        <Issues check={check} document={document} placeOf={placeOf} />
        {product === undefined ? (
          <Skeleton className="h-56 rounded-[18px]" />
        ) : product && order ? (
          <>
            <OrderSummary product={product} order={order} />
            <DeliveryNote total={order.total} arrives />
          </>
        ) : null}
        <Approval
          data={data}
          product={product}
          order={order}
          onAdded={() => setAdded(true)}
          {...back}
        />
      </div>
    </div>
  );
}

const titleClass = "font-display text-4xl leading-[1.05] font-medium";

/** One face of the design at a time, flat, exactly as it prints. */
function ProofFaces({
  document,
  fields,
  assets,
  placeOf,
  sheet,
}: {
  document: DesignDocument;
  fields: Fields;
  assets: readonly AssetLink[];
  placeOf: PlaceOf;
  sheet: boolean;
}) {
  const t = useI18n();
  const faces = document.pieces.flatMap((piece) =>
    faceNames
      .filter((face) => piece[face])
      .map((face) => ({ piece, face, key: `${piece.id}:${face}` })),
  );
  const [shown, setShown] = useState(faces[0]?.key ?? "");
  const [guides, setGuides] = useState(false);
  const current = faces.find((each) => each.key === shown) ?? faces[0];
  if (!current) return null;
  // One piece's faces are its sides; several pieces' are named.
  const onePiece = document.pieces.length === 1;
  const options = faces.map(({ piece, face, key }) => ({
    value: key,
    label: onePiece
      ? face === "back"
        ? t("design.backSide")
        : t("design.front")
      : face === "back"
        ? `${piece.name ?? piece.id} · ${t("design.backSide")}`
        : (piece.name ?? piece.id),
  }));
  const place = placeOf(current.piece.id, current.face);
  return (
    <div className="flex flex-col gap-3.5 bg-secondary/70 px-5 pt-5 pb-6 sm:px-7 lg:w-[45%] lg:shrink-0">
      <div
        className={cn(
          "flex flex-wrap items-center justify-between gap-2.5",
          // The sheet's close button is above it on a phone.
          sheet && "max-lg:pr-10",
        )}
      >
        <span className="text-[13px] font-medium">{place}</span>
        {faces.length > 1 ? (
          <SegmentedControl
            label={t("proof.faces")}
            value={current.key}
            onValueChange={setShown}
            options={options}
            className="bg-card/90"
          />
        ) : null}
      </div>
      <figure className="flex flex-1 items-center justify-center py-2">
        <div
          className="w-full"
          // As wide as fits, and no taller than most of the screen.
          style={{
            maxWidth: `min(400px, calc(60dvh * ${current.piece.width} / ${current.piece.height}))`,
          }}
        >
          <DesignPreview
            document={document}
            fields={fields}
            assets={assets}
            view={{
              kind: "face",
              piece: current.piece.id,
              face: current.face,
              guides,
            }}
            title={place}
            className="shadow-[0_1px_2px_rgb(0_0_0/0.08),0_18px_36px_-18px_rgb(60_45_30/0.45)]"
          />
        </div>
      </figure>
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <p className="max-w-sm text-xs leading-relaxed text-muted-foreground">
          {t("proof.asPrinted")}
        </p>
        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          <input
            type="checkbox"
            checked={guides}
            onChange={(event) => setGuides(event.target.checked)}
            className="size-3.5 accent-[var(--color-primary)]"
          />
          {t("design.guides")}
        </label>
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
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <LoaderCircle className="size-4 animate-spin" aria-hidden />
        {t("proof.checking")}
      </p>
    );
  if (check.issues.length === 0)
    return (
      <p className="flex items-start gap-2.5 rounded-2xl bg-primary/10 px-3.5 py-2.5 text-[13px] leading-relaxed">
        <Check className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
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
    <section>
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
 * What the couple orders: the paper and each order option's choice, with
 * what it adds to each one, what one comes to, how many and the total.
 */
function OrderSummary({
  product,
  order,
}: {
  product: OrderedProduct;
  order: Order;
}) {
  const t = useI18n();
  const price = usePrice();
  const adds = useAdds();
  const rows = [
    ...product.options.map((option) => {
      const value = order.values.get(option.name);
      return {
        key: option.name,
        label: isPaper(option) ? t("design.paper") : option.name,
        value: value?.name,
        adds: value?.surcharge,
      };
    }),
    ...chosenOptions(product).map((option) => {
      const choice = order.choices.get(option.key);
      return {
        key: option.key,
        label: option.label,
        value: choice === null ? t("finishes.none") : choice?.label,
        adds: choice === null ? 0 : choice?.price,
      };
    }),
  ];
  return (
    <section className="rounded-[18px] border border-border bg-card">
      <div className="flex items-baseline justify-between gap-3 px-4.5 pt-3.5 pb-2.5">
        <h3 className="text-sm font-semibold">{t("proof.yourOrder")}</h3>
        <span className="text-[13px] text-muted-foreground">
          {t("proof.count", { count: order.quantity })}
        </span>
      </div>
      <dl className="grid grid-cols-[auto_1fr_auto] gap-x-3.5 gap-y-1.75 px-4.5 text-[13px]">
        {rows.map((row) => (
          <Fragment key={row.key}>
            <dt className="text-muted-foreground">{row.label}</dt>
            <dd className={cn(row.value === undefined && "font-medium")}>
              {row.value ?? t("finishes.choose")}
            </dd>
            <dd className="text-right text-muted-foreground">
              {row.adds === undefined ? null : adds.short(row.adds)}
            </dd>
          </Fragment>
        ))}
        {/* The couple typed their text, diacritics too: no fee for them. */}
        <dt className="text-muted-foreground">{t("proof.diacritics")}</dt>
        <dd>{t("proof.asWritten")}</dd>
        <dd className="text-right text-muted-foreground">
          {t("finishes.included")}
        </dd>
      </dl>
      <div className="mt-3 flex items-baseline justify-between gap-3 border-t border-border/70 px-4.5 pt-3 pb-3.5">
        <span className="text-[13px] text-muted-foreground">
          {t("proof.perQuantity", {
            price: price(order.price),
            count: order.quantity,
          })}
        </span>
        <span className="font-display text-3xl leading-none font-semibold">
          {price(order.total)}
        </span>
      </div>
    </section>
  );
}

/** What the courier costs an order of this much, and when it arrives. */
function DeliveryNote({
  total,
  arrives = false,
}: {
  total: number;
  arrives?: boolean;
}) {
  const t = useI18n();
  const price = usePrice();
  return (
    <p className="text-[12.5px] leading-relaxed text-muted-foreground">
      {total >= FREE_DELIVERY_FROM
        ? t("proof.freeDelivery", { freeFrom: price(FREE_DELIVERY_FROM) })
        : t("suite.delivery", {
            courier: price(COURIER_PRICE),
            freeFrom: price(FREE_DELIVERY_FROM),
          })}
      {arrives ? ` ${t("suite.arrives")}` : null}
    </p>
  );
}

/** Back to the design: closing the sheet, or a link from the page. */
function BackButton({
  designId,
  onBack,
  children,
}: {
  designId: Id<"designs">;
  onBack?: () => void;
  children: ReactNode;
}) {
  return onBack ? (
    <Button variant="ghost" size="lg" className="px-4.5" onClick={onBack}>
      {children}
    </Button>
  ) : (
    <Button asChild variant="ghost" size="lg" className="px-4.5">
      <Link href={`/studio/design/${designId}`}>{children}</Link>
    </Button>
  );
}

/** A button's label with the price it comes to after a thin rule. */
function Priced({ label, total }: { label: string; total: string }) {
  return (
    <>
      {label}
      <span className="h-4 w-px bg-primary-foreground/35" aria-hidden />
      <b className="font-semibold">{total}</b>
    </>
  );
}

/**
 * The couple's approval: the design as it is now, with their details, put
 * in the cart with its finishes as soon as it's approved. One already
 * approved goes in the cart without a second tick. An item the shop doesn't
 * sell is ordered by writing to Jolene, the proof approved.
 */
function Approval({
  data,
  product,
  order,
  onAdded,
  onBack,
  onFinishes,
}: {
  data: DesignData;
  product: OrderedProduct | null | undefined;
  order: Order | null;
  onAdded: () => void;
} & Back) {
  const t = useI18n();
  const locale = useCurrentLocale();
  const price = usePrice();
  const designId = data.design._id;
  const latest = useQuery(api.proofs.latest, { designId });
  const approve = useMutation(api.proofs.approve);
  const attachImage = useAction(api.proofs.attachImage);
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState<"approving" | "preparing" | "adding">();
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

  // Puts the design in the cart with its finishes, or says why not.
  const add = async (proofId: Id<"proofs">) => {
    if (!order) return;
    setBusy("adding");
    const error = await addToCart({
      proofId,
      quantity: order.quantity,
      options: order.line.options,
      answers: order.line.answers,
    });
    if (error === null) onAdded();
    else
      toast.error(
        error === errors.productUnavailable
          ? t("proof.unavailable")
          : error === errors.invalidLine
            ? t("proof.mismatch")
            : t("common.error"),
      );
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
      if (product) await add(result.proofId);
    } catch {
      toast.error(t("common.error"));
    } finally {
      setBusy(undefined);
    }
  };

  const onAdd = async (proofId: Id<"proofs">) => {
    try {
      await add(proofId);
    } finally {
      setBusy(undefined);
    }
  };

  if (latest === undefined || product === undefined)
    return <Skeleton className="h-28 rounded-2xl" />;

  const back = (
    <BackButton designId={designId} onBack={onBack}>
      {t("proof.back")}
    </BackButton>
  );
  const working = busy ? (
    <>
      <LoaderCircle className="animate-spin" aria-hidden />
      {t(`proof.${busy}`)}
    </>
  ) : null;

  // The shop doesn't sell it: approved, it's ordered by writing to Jolene.
  if (product === null || order === null) {
    if (latest?.current)
      return (
        <section className="space-y-4 border-t border-border/70 pt-5">
          <p className="flex items-start gap-2 text-sm">
            <CircleCheck
              className="mt-0.5 size-4 shrink-0 text-primary"
              aria-hidden
            />
            {t("proof.approved", { date: formatDate(latest.approvedAt) })}
          </p>
          <p className="text-sm text-muted-foreground">
            {t("proof.notOnline")}
          </p>
          <div className="flex flex-wrap items-center gap-2.5">
            <Button asChild size="lg">
              <a
                href={`mailto:${JOLENE_EMAIL}?subject=${encodeURIComponent(
                  t("proof.mailSubject", { code: latest._id }),
                )}`}
              >
                {t("proof.write")}
              </a>
            </Button>
            <BackButton designId={designId} onBack={onBack}>
              {t("proof.edit")}
            </BackButton>
          </div>
        </section>
      );
    return (
      <section className="space-y-4 border-t border-border/70 pt-5">
        {latest ? (
          <p className="text-sm text-muted-foreground">
            {t("proof.earlier", { date: formatDate(latest.approvedAt) })}
          </p>
        ) : null}
        <Confirm checked={confirmed} onChange={setConfirmed} />
        <div className="flex flex-wrap items-center gap-2.5">
          <Button
            size="lg"
            disabled={!confirmed || busy !== undefined}
            onClick={onApprove}
          >
            {working ?? t("proof.approve")}
          </Button>
          {back}
        </div>
      </section>
    );
  }

  // Something is still to choose, which the Finisaje tab asks.
  if (order.missing.length > 0) {
    const titles = order.missing.map((name) => {
      const option = product.options.find((each) => each.name === name);
      return option && isPaper(option) ? t("design.paper") : name;
    });
    return (
      <section className="space-y-4">
        <p className="flex items-start gap-2 text-sm">
          <CircleAlert
            className="mt-0.5 size-4 shrink-0 text-gold"
            aria-hidden
          />
          {t("proof.missing", {
            options: new Intl.ListFormat(locale === "ro" ? "ro" : "en-GB", {
              type: "conjunction",
            }).format(titles),
          })}
        </p>
        {onFinishes ? (
          <Button size="lg" onClick={onFinishes}>
            {t("proof.toFinishes")}
          </Button>
        ) : (
          <Button asChild size="lg">
            <Link href={`/studio/design/${designId}`}>
              {t("proof.toFinishes")}
            </Link>
          </Button>
        )}
      </section>
    );
  }

  if (latest?.current)
    return (
      <section className="space-y-4">
        <p className="flex items-start gap-2 text-sm">
          <CircleCheck
            className="mt-0.5 size-4 shrink-0 text-primary"
            aria-hidden
          />
          {t("proof.approved", { date: formatDate(latest.approvedAt) })}
        </p>
        <div className="flex flex-wrap items-center gap-2.5">
          <Button
            size="lg"
            disabled={busy !== undefined}
            onClick={() => onAdd(latest._id)}
          >
            {working ?? (
              <Priced label={t("proof.add")} total={price(order.total)} />
            )}
          </Button>
          {back}
        </div>
      </section>
    );

  return (
    <section className="space-y-4">
      {latest ? (
        <p className="text-sm text-muted-foreground">
          {t("proof.earlier", { date: formatDate(latest.approvedAt) })}
        </p>
      ) : null}
      <Confirm checked={confirmed} onChange={setConfirmed} />
      <div className="flex flex-wrap items-center gap-2.5">
        <Button
          size="lg"
          disabled={!confirmed || busy !== undefined}
          onClick={onApprove}
        >
          {working ?? (
            <Priced
              label={t("proof.approveAndAdd")}
              total={price(order.total)}
            />
          )}
        </Button>
        {back}
      </div>
    </section>
  );
}

/** The tick that says the couple read it all. */
function Confirm({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  const t = useI18n();
  return (
    <label className="flex items-start gap-3 text-sm leading-snug">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="mt-0.5 size-5 shrink-0 accent-[var(--color-primary)]"
      />
      {t("proof.confirm")}
    </label>
  );
}

/**
 * The design is in the cart: what went in and for how much, the way to the
 * cart, and more of the collection for the same event.
 */
function InCart({
  data,
  product,
  order,
  title,
  description,
  sheet,
  onBack,
}: {
  data: DesignData;
  product: OrderedProduct;
  order: Order;
  title: (text: string) => ReactNode;
  description: (text: string) => ReactNode;
  sheet: boolean;
} & Back) {
  const t = useI18n();
  const locale = useCurrentLocale();
  const price = usePrice();
  const latest = useQuery(api.proofs.latest, { designId: data.design._id });
  const document = data.design.document as DesignDocument;
  const front = document.pieces[0];
  // What the couple chose, leaving out the shop's free first choices, such
  // as no ribbon, which the summary before named.
  const chosen = chosenOptions(product).flatMap((option) => {
    const choice = order.choices.get(option.key);
    return choice && (choice !== option.choices[0] || choice.price > 0)
      ? [`${option.label}: ${choice.label}`]
      : [];
  });
  const details = [
    t("proof.count", { count: order.quantity }),
    ...order.line.options.map((option) => option.value),
    ...chosen,
  ].join(" · ");
  return (
    <div className="mx-auto flex max-w-[880px] flex-col gap-5.5 px-5 py-7 sm:px-9 sm:py-8">
      <div className={cn("flex items-start gap-4", sheet && "pr-8")}>
        <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Check className="size-5.5" aria-hidden />
        </span>
        <div className="flex flex-col gap-1">
          {title(t("proof.inCart"))}
          {description(
            latest
              ? t("proof.approvedThen", {
                  date: new Intl.DateTimeFormat(
                    locale === "ro" ? "ro-RO" : "en-GB",
                    { dateStyle: "long" },
                  ).format(latest.approvedAt),
                })
              : "",
          )}
        </div>
      </div>
      <div className="flex items-center gap-4 rounded-[18px] border border-border bg-card px-4 py-3.5">
        {front?.front ? (
          <div className="w-14 shrink-0">
            <DesignPreview
              document={document}
              fields={data.event.fields}
              assets={data.assets}
              view={{ kind: "face", piece: front.id, face: "front" }}
              className="shadow-[0_6px_14px_-8px_rgb(60_45_30/0.5)]"
            />
          </div>
        ) : null}
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="text-[15px] font-medium">{product.title}</span>
          <span className="text-[13px] leading-snug text-muted-foreground">
            {details}
          </span>
        </div>
        <span className="shrink-0 font-display text-[26px] font-semibold">
          {price(order.total)}
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-2.5">
        <Button asChild size="lg">
          {/* The shop is another app on this address: a plain link loads it. */}
          <a href="/cart">
            {t("proof.checkout")}
            <ArrowRight aria-hidden />
          </a>
        </Button>
        <BackButton designId={data.design._id} onBack={onBack}>
          {t("proof.back")}
        </BackButton>
        <div className="sm:ml-auto">
          <DeliveryNote total={order.total} />
        </div>
      </div>
      <SameEvent data={data} />
    </div>
  );
}

/**
 * Up to three more of the collection's pieces the shop sells, for the same
 * event, that the couple hasn't designed yet: each already shows their
 * details, as every design of the event does, and starts its design.
 */
function SameEvent({ data }: { data: DesignData }) {
  const t = useI18n();
  const suite = useQuery(api.catalog.suite, {
    slug: data.template.suite.slug,
  });
  const mine = useQuery(api.designs.mine, {});
  if (!suite || !mine) return null;
  const designed = new Set(
    mine.designs
      .filter((design) => design.eventId === data.event._id)
      .map((design) => design.templateId),
  );
  const offers = suite.templates
    .filter((template) => template.product && !designed.has(template._id))
    .slice(0, SUGGESTED);
  if (offers.length === 0) return null;
  const { occasion } = data.event;
  return (
    <section className="flex flex-col gap-3.5 border-t border-border/70 pt-5.5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="font-display text-[26px] font-medium">
          {t(`proof.sameEvent.${occasion}`)}
        </h3>
        <span className="text-[13px] text-muted-foreground">
          {t(`proof.sameDetails.${occasion}`)}
        </span>
      </div>
      <ul className="grid gap-4 sm:grid-cols-3">
        {offers.map((offer) => (
          <Offer
            key={offer.slug}
            offer={offer}
            fields={data.event.fields}
            assets={suite.assets}
          />
        ))}
      </ul>
    </section>
  );
}

type Offered = NonNullable<
  FunctionReturnType<typeof api.catalog.suite>
>["templates"][number];

/** A piece of the collection to design next, with what one costs. */
function Offer({
  offer,
  fields,
  assets,
}: {
  offer: Offered;
  fields: Fields;
  assets: readonly AssetLink[];
}) {
  const t = useI18n();
  const locale = useCurrentLocale();
  const price = usePrice();
  const { pending, start } = useStartDesign(offer.slug);
  const document = offer.document as DesignDocument;
  const name = productKindLabels[offer.kind][locale];
  const shown = useMemo(
    () => previewFields(document.occasion, document.language, fields),
    [document.occasion, document.language, fields],
  );
  return (
    <li>
      <button
        type="button"
        onClick={start}
        disabled={pending}
        className="group flex w-full flex-col gap-2.5 rounded-[18px] text-left outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
      >
        <span className="relative block h-48 rounded-[18px] bg-secondary/70 transition-colors group-hover:bg-secondary">
          <span className="absolute inset-5">
            <DesignPreview
              document={document}
              fields={shown}
              assets={assets}
              title={name}
              className="size-full"
            />
          </span>
          {pending ? (
            <LoaderCircle
              className="absolute top-3 right-3 size-4 animate-spin text-muted-foreground"
              aria-hidden
            />
          ) : null}
        </span>
        <span className="flex items-baseline justify-between gap-2 px-0.5">
          <span className="text-sm font-medium">{name}</span>
          {offer.product ? (
            <span className="text-[13px] text-muted-foreground">
              {t(offer.product.varies ? "suite.from" : "suite.each", {
                price: price(offer.product.price),
              })}
            </span>
          ) : null}
        </span>
      </button>
    </li>
  );
}
