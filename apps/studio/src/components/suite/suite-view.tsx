"use client";

import { api } from "@jolene/backend/convex/_generated/api";
import {
  type DesignDocument,
  type Fields,
  previewFields,
  productKindLabels,
  suiteStyleLabel,
} from "@jolene/design";
import { Badge } from "@jolene/ui/badge";
import { SegmentedControl } from "@jolene/ui/segmented-control";
import { Skeleton } from "@jolene/ui/skeleton";
import { useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { Check, ChevronLeft } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useMemo, useState } from "react";
import { useCurrentLocale, useI18n } from "@/locales/client";
import { type AssetLink, DesignPreview } from "../design/design-preview";
import { StartDesignButton } from "../design/start-design-button";
import { useEventFields } from "../design/use-event-fields";
import { Photo } from "./photo";
import { usePrice } from "./use-price";

type Offer = NonNullable<
  FunctionReturnType<typeof api.catalog.suite>
>["templates"][number];

/**
 * One collection: Jolene's photos of it printed, the design with the
 * couple's details a tap away, what it costs and how it arrives, then every
 * piece it holds, each with its own photo and price.
 */
export function SuiteView() {
  const t = useI18n();
  const locale = useCurrentLocale();
  const price = usePrice();
  const { suite: slug } = useParams<{ suite: string }>();
  const data = useQuery(api.catalog.suite, { slug });
  const own = useEventFields();
  const lead = data?.templates[0];
  const leadDocument = lead?.document as DesignDocument | undefined;
  const fields = useMemo(
    () =>
      data
        ? previewFields(data.suite.occasion, leadDocument?.language ?? "ro", {
            ...data.suite.sampleFields,
            ...own[data.suite.occasion],
          })
        : {},
    [data, leadDocument?.language, own],
  );

  if (data === undefined) return <SuiteSkeleton />;
  if (data === null)
    return (
      <p className="py-24 text-center text-muted-foreground">
        {t("suite.notFound")}
      </p>
    );

  const { suite, templates, assets, delivery } = data;
  const product = lead?.product ?? null;
  return (
    <>
      <Link
        href="/studio#colectii"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ChevronLeft className="size-4" aria-hidden />
        {t("suite.back")}
      </Link>
      <div className="mt-6 grid items-start gap-10 lg:grid-cols-[1.1fr_1fr] lg:gap-14">
        {lead ? (
          <Showcase
            lead={lead}
            others={templates.slice(1)}
            fields={fields}
            assets={assets}
            title={suite.name[locale]}
          />
        ) : null}
        <div className="lg:pt-6">
          <p className="text-xs font-medium uppercase tracking-[0.24em] text-muted-foreground">
            {t(`suite.occasion.${suite.occasion}`)}
          </p>
          <h1 className="mt-3 font-display text-5xl font-medium sm:text-6xl">
            {suite.name[locale]}
          </h1>
          <p className="mt-4 max-w-xl text-lg leading-relaxed text-muted-foreground">
            {suite.description[locale]}
          </p>
          <div className="mt-5 flex flex-wrap gap-1.5">
            {suite.styles.map((style) => (
              <Badge key={style}>{suiteStyleLabel(style, locale)}</Badge>
            ))}
          </div>
          {lead && product ? (
            <div className="mt-8 border-y border-border/70 py-5">
              <p className="text-lg font-medium">
                {t(product.varies ? "home.priceFrom" : "home.price", {
                  item: productKindLabels[lead.kind][locale],
                  price: price(product.price),
                })}
              </p>
              {product.minQuantity !== undefined ? (
                <p className="mt-1 text-sm text-muted-foreground">
                  {t("suite.minimum", { count: product.minQuantity })}
                </p>
              ) : null}
            </div>
          ) : null}
          {lead ? (
            <StartDesignButton template={lead.slug} size="lg" className="mt-8">
              {t("home.personalise")}
            </StartDesignButton>
          ) : null}
          <ul className="mt-8 flex flex-col gap-3 text-sm leading-relaxed">
            {[
              t("suite.seeFirst"),
              t("suite.arrives"),
              t("suite.delivery", {
                courier: price(delivery.courier),
                freeFrom: price(delivery.freeFrom),
              }),
            ].map((line) => (
              <li key={line} className="flex gap-3">
                <Check
                  className="mt-0.5 size-4 shrink-0 text-gold"
                  aria-hidden
                />
                <span>{line}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <h2 className="mt-20 font-display text-3xl">{t("suite.items")}</h2>
      <p className="mt-2 text-muted-foreground">{t("suite.itemsLead")}</p>
      <ul className="mt-6 grid gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-4">
        {templates.map((template) => (
          <ItemCard
            key={template.slug}
            template={template}
            fields={fields}
            assets={assets}
          />
        ))}
      </ul>
    </>
  );
}

/**
 * The collection's photos, the lead item's first and one of each other
 * item's after, and last its design with the couple's details: one large,
 * the rest to pick from.
 */
function Showcase({
  lead,
  others,
  fields,
  assets,
  title,
}: {
  lead: Offer;
  others: Offer[];
  fields: Fields;
  assets: AssetLink[];
  title: string;
}) {
  const t = useI18n();
  const photos = useMemo(
    () => [
      ...(lead.product?.photos ?? []),
      ...others.flatMap((other) => other.product?.photos.slice(0, 1) ?? []),
    ],
    [lead, others],
  );
  // A photo's place, or one past the last for the design.
  const [index, setIndex] = useState(0);
  const shown = Math.min(index, photos.length);
  const photo = photos[shown];
  const count = photos.length + 1;
  const document = lead.document as DesignDocument;
  const design = (
    <DesignPreview
      document={document}
      fields={fields}
      assets={assets}
      title={title}
      className="size-full"
    />
  );
  return (
    <div className="min-w-0">
      <div className="relative aspect-[4/5] overflow-hidden rounded-[2rem] bg-secondary/70">
        {photo ? (
          <Photo
            photo={photo}
            preload={shown === 0}
            sizes="(min-width: 1024px) 52vw, 100vw"
          />
        ) : (
          <div className="absolute inset-8 sm:inset-12">{design}</div>
        )}
        {photos.length > 0 ? (
          <>
            <SegmentedControl
              label={t("suite.showing")}
              value={photo ? "real" : "design"}
              onValueChange={(value) =>
                setIndex(value === "design" ? photos.length : 0)
              }
              options={[
                { value: "real", label: t("suite.real") },
                { value: "design", label: t("suite.yourNames") },
              ]}
              className="absolute top-4 left-4 bg-card/90 shadow-sm backdrop-blur-sm"
            />
            <span className="absolute right-4 bottom-4 rounded-full bg-card/90 px-3 py-1 text-xs font-medium tabular-nums shadow-sm">
              {t("suite.photoOf", { index: shown + 1, count })}
            </span>
          </>
        ) : null}
      </div>
      {photos.length > 0 ? (
        <>
          <fieldset className="mt-3 flex min-w-0 gap-2 overflow-x-auto p-1 sm:flex-wrap sm:overflow-visible">
            <legend className="sr-only">{t("suite.photos")}</legend>
            {photos.map((item, place) => (
              <button
                // biome-ignore lint/suspicious/noArrayIndexKey: two items can share a photo
                key={`${place}-${item.url}`}
                type="button"
                aria-pressed={place === shown}
                aria-label={`${item.alt}, ${t("suite.photoOf", { index: place + 1, count })}`}
                onClick={() => setIndex(place)}
                className={thumbClass}
              >
                <Photo photo={item} decorative sizes="80px" />
              </button>
            ))}
            <button
              type="button"
              aria-pressed={shown === photos.length}
              aria-label={t("suite.yourNames")}
              onClick={() => setIndex(photos.length)}
              className={`${thumbClass} p-1.5`}
            >
              <DesignPreview
                document={document}
                fields={fields}
                assets={assets}
                className="size-full"
              />
            </button>
          </fieldset>
          <p className="mt-2 text-sm text-muted-foreground">
            {t("suite.photosNote")}
          </p>
        </>
      ) : null}
    </div>
  );
}

const thumbClass =
  "relative size-16 shrink-0 overflow-hidden rounded-xl bg-secondary/70 ring-offset-2 ring-offset-background outline-none transition-shadow aria-pressed:ring-2 aria-pressed:ring-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 sm:size-20";

/** One piece of the collection: its photo or its design, size and price. */
function ItemCard({
  template,
  fields,
  assets,
}: {
  template: Offer;
  fields: Fields;
  assets: AssetLink[];
}) {
  const t = useI18n();
  const locale = useCurrentLocale();
  const price = usePrice();
  const [showing, setShowing] = useState<"photo" | "design">("photo");
  const document = template.document as DesignDocument;
  const piece = document.pieces[0];
  const photo = template.product?.photos[0];
  const name = productKindLabels[template.kind][locale];
  return (
    <li className="flex flex-col">
      <div className="relative aspect-square overflow-hidden rounded-3xl bg-secondary/70">
        {photo && showing === "photo" ? (
          <Photo
            photo={photo}
            sizes="(min-width: 1024px) 24vw, (min-width: 640px) 45vw, 100vw"
          />
        ) : (
          <div className="absolute inset-6">
            <DesignPreview
              document={document}
              fields={fields}
              assets={assets}
              title={name}
              className="size-full"
            />
          </div>
        )}
        {photo ? (
          <SegmentedControl
            label={t("suite.showing")}
            value={showing}
            onValueChange={setShowing}
            options={[
              { value: "photo", label: t("suite.photo") },
              { value: "design", label: t("suite.design") },
            ]}
            className="absolute top-3 left-3 bg-card/90 shadow-sm backdrop-blur-sm"
          />
        ) : null}
      </div>
      <h3 className="mt-4 font-display text-2xl">{name}</h3>
      {piece ? (
        <p className="text-sm text-muted-foreground">
          {t(document.envelope ? "suite.sizeWithEnvelope" : "suite.size", {
            width: piece.width,
            height: piece.height,
          })}
        </p>
      ) : null}
      {template.product ? (
        <p className="mt-1 text-sm">
          {t(template.product.varies ? "suite.from" : "suite.each", {
            price: price(template.product.price),
          })}
        </p>
      ) : null}
      <StartDesignButton
        template={template.slug}
        variant="outline"
        size="sm"
        className="mt-3 self-start"
      >
        {t("home.personalise")}
      </StartDesignButton>
    </li>
  );
}

export function SuiteSkeleton() {
  return (
    <div className="grid gap-10 lg:grid-cols-[1.1fr_1fr] lg:gap-14">
      <Skeleton className="aspect-[4/5] rounded-[2rem]" />
      <div className="space-y-4 pt-10">
        <Skeleton className="h-14 w-2/3" />
        <Skeleton className="h-20 w-full" />
      </div>
    </div>
  );
}
