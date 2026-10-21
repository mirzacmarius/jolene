"use client";

import { useAuthToken } from "@convex-dev/auth/react";
import { api } from "@jolene/backend/convex/_generated/api";
import { Badge } from "@jolene/ui/badge";
import { Button } from "@jolene/ui/button";
import { Input } from "@jolene/ui/input";
import { Label } from "@jolene/ui/label";
import { Skeleton } from "@jolene/ui/skeleton";
import { toast } from "@jolene/ui/toaster";
import { useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { ExternalLink } from "lucide-react";
import { type FormEvent, type ReactNode, useId, useState } from "react";
import { errorCode } from "@/lib/convex-error";
import { leiField, parseLei } from "@/lib/lei";
import { useCurrentLocale, useI18n } from "@/locales/client";
import { useFormats } from "./formats";

type Product = NonNullable<
  FunctionReturnType<typeof api.workshop.products.product>
>;

type Locale = ReturnType<typeof useCurrentLocale>;

/** The longest name a product can have (workshop.products.save). */
const TITLE_LENGTH = 200;

/** The most a price or a surcharge can be, in bani (workshop.products.save). */
const MOST_BANI = 10_000_000;

/** The largest minimum order (workshop.products.save). */
const MOST_PIECES = 10_000;

/** How long the shop gets to refresh its pages after a change. */
const REFRESH_WAIT = 8000;

/** The product's fields as the form shows them: amounts in lei. */
interface Draft {
  title: string;
  price: string;
  compareAtPrice: string;
  minQuantity: string;
  /** Each option's values' surcharges. */
  surcharges: string[][];
  published: boolean;
}

/** What the form saves, as workshop.products.save takes it. */
interface Values {
  title: string;
  price: number;
  compareAtPrice: number | null;
  minQuantity: number | null;
  surcharges: number[][];
  published: boolean;
}

function draftOf(product: Product, locale: Locale): Draft {
  return {
    title: product.title,
    price: leiField(product.price, locale),
    compareAtPrice:
      product.compareAtPrice === undefined
        ? ""
        : leiField(product.compareAtPrice, locale),
    minQuantity:
      product.minQuantity === undefined ? "" : String(product.minQuantity),
    surcharges: product.options.map((option) =>
      option.values.map((value) => leiField(value.surcharge, locale)),
    ),
    published: product.published,
  };
}

function valuesOf(product: Product): Values {
  return {
    title: product.title,
    price: product.price,
    compareAtPrice: product.compareAtPrice ?? null,
    minQuantity: product.minQuantity ?? null,
    surcharges: product.options.map((option) =>
      option.values.map((value) => value.surcharge),
    ),
    published: product.published,
  };
}

/** A product's version: what the form shows of it, and when it changed. */
const versionOf = (product: Product) =>
  JSON.stringify([product.editedAt, valuesOf(product)]);

/** Whether `bani` can be saved: whole, from `least` up to MOST_BANI. */
const isBani = (bani: number | null, least: number) =>
  bani !== null && bani >= least && bani <= MOST_BANI;

/**
 * The draft as it would be saved, and what's wrong with each field, if
 * anything: values only when nothing is.
 */
function readDraft(draft: Draft) {
  const title = draft.title.trim();
  const price = parseLei(draft.price);
  const compareAtPrice =
    draft.compareAtPrice.trim() === "" ? null : parseLei(draft.compareAtPrice);
  const minQuantity =
    draft.minQuantity.trim() === ""
      ? null
      : /^\s*\d{1,5}\s*$/.test(draft.minQuantity)
        ? Number(draft.minQuantity)
        : Number.NaN;
  const surcharges = draft.surcharges.map((values) =>
    values.map((value) => parseLei(value)),
  );
  const problems = {
    title: title === "" || title.length > TITLE_LENGTH,
    price: !isBani(price, 1),
    compareAtPrice:
      draft.compareAtPrice.trim() !== "" &&
      (!isBani(compareAtPrice, 1) ||
        (compareAtPrice !== null && price !== null && compareAtPrice <= price)),
    minQuantity:
      minQuantity !== null &&
      !(
        Number.isInteger(minQuantity) &&
        minQuantity >= 1 &&
        minQuantity <= MOST_PIECES
      ),
    surcharges: surcharges.map((values) =>
      values.map((value) => !isBani(value, 0)),
    ),
  };
  const valid =
    !problems.title &&
    !problems.price &&
    !problems.compareAtPrice &&
    !problems.minQuantity &&
    !problems.surcharges.flat().includes(true);
  const values: Values | null =
    valid && price !== null
      ? {
          title,
          price,
          compareAtPrice,
          minQuantity,
          surcharges: surcharges.map((values) =>
            values.map((value) => value ?? 0),
          ),
          published: draft.published,
        }
      : null;
  return { problems, values };
}

const sameValues = (values: Values | null, product: Product) =>
  values !== null &&
  JSON.stringify(values) === JSON.stringify(valuesOf(product));

/**
 * One of the shop's products, for the workshop to change: its name, its
 * price and the price before a discount, its minimum order, what each of its
 * papers adds, and whether it's for sale.
 */
export function ProductView({ handle }: { handle: string }) {
  const t = useI18n();
  const product = useQuery(api.workshop.products.product, { handle });
  if (product === undefined)
    return (
      <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <Skeleton className="h-96 rounded-3xl" />
        <Skeleton className="h-64 rounded-3xl" />
      </div>
    );
  if (product === null)
    return (
      <p className="rounded-3xl border border-dashed p-10 text-muted-foreground">
        {t("workshop.catalog.notFound")}
      </p>
    );
  return <ProductEditor live={product} />;
}

/**
 * The form, from the version of the product it started from. While nothing
 * is changed in it, it follows the product as it changes; once something is,
 * it says when someone else changes the product, which saving would refuse.
 */
function ProductEditor({ live }: { live: Product }) {
  const t = useI18n();
  const locale = useCurrentLocale();
  const format = useFormats();
  const id = useId();
  const token = useAuthToken();
  const save = useMutation(api.workshop.products.save);
  const [base, setBase] = useState(live);
  const [draft, setDraft] = useState(() => draftOf(live, locale));
  const [busy, setBusy] = useState(false);
  const { problems, values } = readDraft(draft);
  const changed = !sameValues(values, base);

  const follow = (product: Product) => {
    setBase(product);
    setDraft(draftOf(product, locale));
  };
  // A newer version: taken up when the form holds nothing it would lose.
  if (
    versionOf(live) !== versionOf(base) &&
    (!changed || sameValues(values, live))
  )
    follow(live);
  const stale = versionOf(live) !== versionOf(base);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!values || !changed || stale) return;
    setBusy(true);
    try {
      await save({ handle: base.handle, editedAt: base.editedAt, ...values });
    } catch (error) {
      if (errorCode(error) === "product-changed") {
        toast.error(t("workshop.catalog.changed"));
        follow(live);
      } else toast.error(t("common.error"));
      setBusy(false);
      return;
    }
    // The shop's pages keep the catalog for minutes unless it's told.
    const shown = await fetch("/api/catalog/refresh", {
      method: "POST",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      signal: AbortSignal.timeout(REFRESH_WAIT),
    }).then(
      (response) => response.ok,
      () => false,
    );
    toast.success(
      shown ? t("workshop.catalog.saved") : t("workshop.catalog.savedSoon"),
    );
    setBusy(false);
  };

  const field = (name: keyof Omit<Draft, "surcharges" | "published">) => ({
    id: `${id}-${name}`,
    value: draft[name],
    onChange: (event: { target: { value: string } }) =>
      setDraft((current) => ({ ...current, [name]: event.target.value })),
    "aria-invalid": problems[name] || undefined,
    // The name has a hint only when something's wrong with it.
    "aria-describedby":
      name === "title" && !problems.title ? undefined : `${id}-${name}-hint`,
  });

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-3">
        <h1 className="font-display text-5xl">{live.title}</h1>
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
          <Badge variant={live.published ? "default" : "outline"}>
            {live.published
              ? t("workshop.catalog.tabs.forSale")
              : t("workshop.catalog.tabs.offSale")}
          </Badge>
          {live.page && live.published ? (
            <a
              href={live.page}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
            >
              {t("workshop.catalog.inShop")}
              <ExternalLink className="size-3.5" aria-hidden />
            </a>
          ) : null}
          <span className="text-muted-foreground">
            {live.editedAt !== null && live.editedBy !== null
              ? t("workshop.catalog.editedBy", {
                  email: live.editedBy,
                  time: format.time(live.editedAt),
                })
              : t("workshop.catalog.asSeeded")}
          </span>
        </div>
      </div>
      <div className="grid items-start gap-10 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <form
          onSubmit={submit}
          className="flex min-w-0 flex-col gap-6 rounded-3xl border bg-card p-5 sm:p-6"
        >
          {stale ? (
            <div
              role="status"
              className="flex flex-col items-start gap-3 rounded-2xl border border-gold/40 bg-gold/10 p-4 text-sm"
            >
              <p>{t("workshop.catalog.changedMeanwhile")}</p>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => follow(live)}
              >
                {t("workshop.catalog.showTheirs")}
              </Button>
            </div>
          ) : null}
          <Field
            label={t("workshop.catalog.name")}
            htmlFor={`${id}-title`}
            hint={problems.title ? t("workshop.catalog.problems.name") : null}
            hintId={`${id}-title-hint`}
            problem={problems.title}
          >
            <Input {...field("title")} maxLength={TITLE_LENGTH + 20} />
          </Field>
          <div className="grid gap-6 sm:grid-cols-2">
            <Field
              label={t("workshop.catalog.price")}
              htmlFor={`${id}-price`}
              hint={
                problems.price
                  ? t("workshop.catalog.problems.price")
                  : t("workshop.catalog.priceHint")
              }
              hintId={`${id}-price-hint`}
              problem={problems.price}
            >
              <Input
                {...field("price")}
                inputMode="decimal"
                autoComplete="off"
              />
            </Field>
            <Field
              label={t("workshop.catalog.compareAt")}
              htmlFor={`${id}-compareAtPrice`}
              hint={
                problems.compareAtPrice
                  ? t("workshop.catalog.problems.compareAt")
                  : t("workshop.catalog.compareAtHint")
              }
              hintId={`${id}-compareAtPrice-hint`}
              problem={problems.compareAtPrice}
            >
              <Input
                {...field("compareAtPrice")}
                inputMode="decimal"
                autoComplete="off"
              />
            </Field>
            <Field
              label={t("workshop.catalog.minQuantity")}
              htmlFor={`${id}-minQuantity`}
              hint={
                problems.minQuantity
                  ? t("workshop.catalog.problems.minQuantity")
                  : t("workshop.catalog.minQuantityHint")
              }
              hintId={`${id}-minQuantity-hint`}
              problem={problems.minQuantity}
            >
              <Input
                {...field("minQuantity")}
                inputMode="numeric"
                autoComplete="off"
              />
            </Field>
          </div>
          {base.options.map((option, index) => (
            <fieldset key={option.name} className="flex flex-col gap-3">
              <legend className="mb-1 text-sm font-medium">
                {option.name}
                <span className="block font-normal text-muted-foreground">
                  {t("workshop.catalog.papers")}
                </span>
              </legend>
              <div className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
                {option.values.map((value, place) => {
                  const problem = problems.surcharges[index]?.[place] ?? false;
                  const fieldId = `${id}-surcharge-${index}-${place}`;
                  return (
                    <div key={value.name} className="flex flex-col gap-1.5">
                      <Label htmlFor={fieldId} className="font-normal">
                        {value.name}
                      </Label>
                      <Input
                        id={fieldId}
                        inputMode="decimal"
                        autoComplete="off"
                        value={draft.surcharges[index]?.[place] ?? ""}
                        onChange={(event) => {
                          const text = event.target.value;
                          setDraft((current) => ({
                            ...current,
                            surcharges: current.surcharges.map((values, i) =>
                              i === index
                                ? values.map((old, j) =>
                                    j === place ? text : old,
                                  )
                                : values,
                            ),
                          }));
                        }}
                        aria-invalid={problem || undefined}
                        aria-describedby={
                          problem ? `${fieldId}-hint` : undefined
                        }
                      />
                      {problem ? (
                        <p
                          id={`${fieldId}-hint`}
                          className="text-xs text-destructive"
                        >
                          {t("workshop.catalog.problems.surcharge")}
                        </p>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </fieldset>
          ))}
          <div className="flex items-start gap-3 rounded-2xl bg-secondary/50 p-4">
            <input
              id={`${id}-published`}
              type="checkbox"
              checked={draft.published}
              onChange={(event) => {
                const published = event.target.checked;
                setDraft((current) => ({ ...current, published }));
              }}
              aria-describedby={`${id}-published-hint`}
              className="mt-1 size-4 shrink-0 accent-foreground"
            />
            <div className="flex flex-col gap-1">
              <Label htmlFor={`${id}-published`}>
                {t("workshop.catalog.forSale")}
              </Label>
              <p
                id={`${id}-published-hint`}
                className="text-sm text-muted-foreground"
              >
                {draft.published
                  ? t("workshop.catalog.forSaleHint")
                  : base.forEvent
                    ? t("workshop.catalog.forEventHint")
                    : t("workshop.catalog.offSaleHint")}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="submit"
              disabled={busy || !changed || !values || stale}
            >
              {t("workshop.catalog.save")}
            </Button>
            <Button
              type="button"
              variant="ghost"
              disabled={busy || !changed}
              onClick={() => follow(live)}
            >
              {t("workshop.catalog.reset")}
            </Button>
          </div>
        </form>
        <aside className="flex flex-col gap-8">
          <Photos product={live} />
          {live.categories.length > 0 ? (
            <section className="flex flex-col gap-3">
              <h2 className="font-medium">
                {t("workshop.catalog.categories")}
              </h2>
              <ul className="flex flex-wrap gap-2">
                {live.categories.map((category) => (
                  <li key={category.handle}>
                    <Badge variant="outline">{category.title}</Badge>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </aside>
      </div>
    </div>
  );
}

function Field({
  label,
  htmlFor,
  hint,
  hintId,
  problem,
  children,
}: {
  label: string;
  htmlFor: string;
  hint: string | null;
  hintId: string;
  problem: boolean;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {hint ? (
        <p
          id={hintId}
          className={
            problem
              ? "text-xs text-destructive"
              : "text-xs text-muted-foreground"
          }
        >
          {hint}
        </p>
      ) : null}
    </div>
  );
}

function Photos({ product }: { product: Product }) {
  const t = useI18n();
  return (
    <section className="flex flex-col gap-3">
      <h2 className="font-medium">{t("workshop.catalog.photos")}</h2>
      {product.images.length > 0 ? (
        <ul className="grid grid-cols-3 gap-2">
          {product.images.map((image) => (
            <li key={image.url}>
              <a href={image.url} target="_blank" rel="noreferrer">
                <img
                  src={image.url}
                  alt={image.alt}
                  loading="lazy"
                  className="aspect-square w-full rounded-xl bg-secondary/70 object-cover"
                />
              </a>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">
          {t("workshop.catalog.noPhotos")}
        </p>
      )}
    </section>
  );
}
