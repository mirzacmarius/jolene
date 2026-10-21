"use client";

import { useAuthToken } from "@convex-dev/auth/react";
import { api } from "@jolene/backend/convex/_generated/api";
import type { Id } from "@jolene/backend/convex/_generated/dataModel";
import { Badge } from "@jolene/ui/badge";
import { Button } from "@jolene/ui/button";
import { Input } from "@jolene/ui/input";
import { Label } from "@jolene/ui/label";
import { Skeleton } from "@jolene/ui/skeleton";
import { toast } from "@jolene/ui/toaster";
import { useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import {
  ArrowDown,
  ArrowUp,
  ExternalLink,
  ImagePlus,
  LoaderCircle,
  X,
} from "lucide-react";
import {
  type DragEvent,
  type FormEvent,
  type ReactNode,
  useId,
  useRef,
  useState,
} from "react";
import { errorCode } from "@/lib/convex-error";
import { leiField, parseLei } from "@/lib/lei";
import { moved } from "@/lib/lists";
import { refreshShop } from "@/lib/shop";
import { NotAPhoto, webPhoto } from "@/lib/web-photo";
import { useCurrentLocale, useI18n } from "@/locales/client";
import { useFormats } from "./formats";
import { IconButton } from "./icon-button";

type Product = NonNullable<
  FunctionReturnType<typeof api.workshop.products.product>
>;

type LineOption = Product["lineOptions"][number];

type Locale = ReturnType<typeof useCurrentLocale>;

/** The longest name a product can have (workshop.products.save). */
const TITLE_LENGTH = 200;

/** The most a price or a surcharge can be, in bani (workshop.products.save). */
const MOST_BANI = 10_000_000;

/** The largest minimum order (workshop.products.save). */
const MOST_PIECES = 10_000;

/** The most photos a product can have (workshop.products.save). */
const MOST_PHOTOS = 20;

/** The longest a photo's description can be (workshop.products.save). */
const ALT_LENGTH = 200;

/** The largest photo the workshop can upload (workshop.products.photoUploaded). */
const PHOTO_BYTES = 10 * 1024 * 1024;

/** The most order options a product can ask (workshop.products.save). */
const MOST_LINE_OPTIONS = 20;

/** How much of an order option's choices the list of them to add shows. */
const ASKS_SHOWN = 90;

const selectClass =
  "h-10 w-full min-w-0 rounded-lg border border-input bg-card px-3 text-[15px] shadow-xs outline-none transition-[border-color,box-shadow] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/30 disabled:cursor-not-allowed disabled:opacity-50";

/** A photo in the form: one the product had, by its place, or one uploaded since. */
type Photo = { url: string; alt: string } & (
  | { kept: number }
  | { upload: Id<"_storage"> }
);

/** The product's fields as the form shows them: amounts in lei. */
interface Draft {
  title: string;
  price: string;
  compareAtPrice: string;
  minQuantity: string;
  /** Each option's values' surcharges. */
  surcharges: string[][];
  photos: Photo[];
  /** Its categories' handles, its main one first. */
  categories: string[];
  /** The order options its line asks, in order. */
  lineOptions: LineOption[];
  published: boolean;
}

/** What the form saves, as the page compares it with the product. */
interface Values {
  title: string;
  price: number;
  compareAtPrice: number | null;
  minQuantity: number | null;
  surcharges: number[][];
  /** Each photo's address and what it shows. */
  photos: { url: string; alt: string }[];
  categories: string[];
  /** The order options' handles. */
  lineOptions: string[];
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
    photos: product.images.map(({ url, alt }, kept) => ({ kept, url, alt })),
    categories: product.categories.map(({ handle }) => handle),
    lineOptions: product.lineOptions,
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
    photos: product.images.map(({ url, alt }) => ({ url, alt: alt.trim() })),
    categories: product.categories.map(({ handle }) => handle),
    lineOptions: product.lineOptions.map(({ handle }) => handle),
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
          photos: draft.photos.map(({ url, alt }) => ({
            url,
            alt: alt.trim(),
          })),
          categories: draft.categories,
          lineOptions: draft.lineOptions.map(({ handle }) => handle),
          published: draft.published,
        }
      : null;
  return { problems, values };
}

const sameValues = (values: Values | null, product: Product) =>
  values !== null &&
  JSON.stringify(values) === JSON.stringify(valuesOf(product));

/** The photos as workshop.products.save takes them. */
const savedPhotos = (photos: Photo[]) =>
  photos.map((photo) =>
    "kept" in photo
      ? { kept: photo.kept, alt: photo.alt }
      : { upload: photo.upload, alt: photo.alt },
  );

/**
 * One of the shop's products, for the workshop to change: its name, its
 * price and the price before a discount, its minimum order, what each of its
 * papers adds, its photos, its categories, the order options its line asks,
 * and whether it's for sale.
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
  const photoUploadUrl = useMutation(api.workshop.products.photoUploadUrl);
  const photoUploaded = useMutation(api.workshop.products.photoUploaded);
  const categories = useQuery(api.workshop.products.categories);
  const lineOptions = useQuery(api.workshop.products.lineOptions);
  const [base, setBase] = useState(live);
  const [draft, setDraft] = useState(() => draftOf(live, locale));
  const [busy, setBusy] = useState(false);
  /** Photos still on their way up. */
  const [uploading, setUploading] = useState(0);
  const { problems, values } = readDraft(draft);
  const changed = !sameValues(values, base);
  const listed = new Set(categories?.map(({ handle }) => handle));
  // A category the shop no longer lists stays on the product until taken off.
  const shelves = categories && [
    ...categories.map((category) => ({ ...category, unlisted: false })),
    ...base.categories
      .filter(({ handle }) => !listed.has(handle))
      .map((category) => ({ ...category, unlisted: true })),
  ];

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
    if (!values || !changed || stale || uploading > 0) return;
    setBusy(true);
    try {
      await save({
        handle: base.handle,
        editedAt: base.editedAt,
        ...values,
        photos: savedPhotos(draft.photos),
      });
    } catch (error) {
      if (errorCode(error) === "product-changed") {
        toast.error(t("workshop.catalog.changed"));
        follow(live);
      } else toast.error(t("common.error"));
      setBusy(false);
      return;
    }
    const shown = await refreshShop(token);
    toast.success(
      shown ? t("workshop.catalog.saved") : t("workshop.catalog.savedSoon"),
    );
    setBusy(false);
  };

  /** Makes a photo fit for the web and uploads it: its upload and address. */
  const upload = async (file: File) => {
    const photo = await webPhoto(file);
    if (photo.size > PHOTO_BYTES) throw new NotAPhoto();
    const response = await fetch(await photoUploadUrl(), {
      method: "POST",
      headers: { "Content-Type": photo.type },
      body: photo,
    });
    if (!response.ok) throw new Error(`Upload failed: ${response.status}`);
    const { storageId } = (await response.json()) as {
      storageId: Id<"_storage">;
    };
    return { upload: storageId, url: await photoUploaded({ storageId }) };
  };

  /** Uploads the photos chosen one after another, each to the end of the list. */
  const addPhotos = async (files: File[]) => {
    const room = Math.max(MOST_PHOTOS - draft.photos.length - uploading, 0);
    if (files.length > room)
      toast.error(t("workshop.catalog.tooManyPhotos", { count: MOST_PHOTOS }));
    const chosen = files.slice(0, room);
    setUploading((count) => count + chosen.length);
    for (const file of chosen) {
      try {
        const photo = await upload(file);
        setDraft((current) => ({
          ...current,
          // Described by the product's name until someone writes better.
          photos: [...current.photos, { ...photo, alt: current.title.trim() }],
        }));
      } catch (error) {
        toast.error(
          error instanceof NotAPhoto || errorCode(error) === "invalid-image"
            ? t("workshop.catalog.notAPhoto", { name: file.name })
            : t("workshop.catalog.uploadFailed", { name: file.name }),
        );
      } finally {
        setUploading((count) => count - 1);
      }
    }
  };

  const field = (
    name: keyof Pick<
      Draft,
      "title" | "price" | "compareAtPrice" | "minQuantity"
    >,
  ) => ({
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
      <form onSubmit={submit} className="flex flex-col gap-6">
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
              disabled={uploading > 0}
              onClick={() => follow(live)}
            >
              {t("workshop.catalog.showTheirs")}
            </Button>
          </div>
        ) : null}
        <div className="grid items-start gap-10 lg:grid-cols-[minmax(0,1fr)_20rem]">
          <div className="flex min-w-0 flex-col gap-6 rounded-3xl border bg-card p-5 sm:p-6">
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
                    const problem =
                      problems.surcharges[index]?.[place] ?? false;
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
            <LineOptionsField
              chosen={draft.lineOptions}
              all={lineOptions}
              onChange={(change) =>
                setDraft((current) => ({
                  ...current,
                  lineOptions: change(current.lineOptions),
                }))
              }
            />
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
          </div>
          <div className="flex min-w-0 flex-col gap-8">
            <PhotosField
              photos={draft.photos}
              uploading={uploading}
              onAdd={addPhotos}
              onChange={(change) =>
                setDraft((current) => ({
                  ...current,
                  photos: change(current.photos),
                }))
              }
            />
            <CategoriesField
              chosen={draft.categories}
              shelves={shelves}
              onChange={(change) =>
                setDraft((current) => ({
                  ...current,
                  categories: change(current.categories),
                }))
              }
            />
          </div>
        </div>
        <div className="sticky bottom-0 z-10 -mx-2 flex flex-wrap items-center gap-2 border-t bg-background/95 px-2 py-3 backdrop-blur supports-[backdrop-filter]:bg-background/80">
          <Button
            type="submit"
            disabled={busy || uploading > 0 || !changed || !values || stale}
          >
            {t("workshop.catalog.save")}
          </Button>
          <Button
            type="button"
            variant="ghost"
            disabled={busy || uploading > 0 || !changed}
            onClick={() => follow(live)}
          >
            {t("workshop.catalog.reset")}
          </Button>
          {changed && !stale ? (
            <span className="text-sm text-muted-foreground">
              {t("workshop.catalog.unsaved")}
            </span>
          ) : null}
        </div>
      </form>
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

/**
 * The product's photos, the first one in lists and the cart: each with what
 * it shows, to move or take off, and new ones to upload or drop in.
 */
function PhotosField({
  photos,
  uploading,
  onAdd,
  onChange,
}: {
  photos: Photo[];
  uploading: number;
  onAdd: (files: File[]) => void;
  onChange: (change: (photos: Photo[]) => Photo[]) => void;
}) {
  const t = useI18n();
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const [dropping, setDropping] = useState(false);
  const full = photos.length + uploading >= MOST_PHOTOS;

  const carriesFiles = (event: DragEvent) =>
    event.dataTransfer.types.includes("Files");

  return (
    <section
      aria-labelledby={`${id}-title`}
      onDragOver={(event) => {
        if (!carriesFiles(event) || full) return;
        event.preventDefault();
        setDropping(true);
      }}
      onDragLeave={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null))
          setDropping(false);
      }}
      onDrop={(event) => {
        if (!carriesFiles(event)) return;
        event.preventDefault();
        setDropping(false);
        if (!full) onAdd(Array.from(event.dataTransfer.files));
      }}
      className={`-m-3 flex flex-col gap-3 rounded-3xl p-3 transition-shadow ${
        dropping ? "bg-gold/5 ring-2 ring-gold/50" : ""
      }`}
    >
      <div className="flex flex-col gap-1">
        <h2 id={`${id}-title`} className="font-medium">
          {t("workshop.catalog.photos")}
        </h2>
        <p className="text-sm text-muted-foreground">
          {t("workshop.catalog.photosHint")}
        </p>
      </div>
      {photos.length > 0 || uploading > 0 ? (
        <ol className="flex flex-col gap-3">
          {photos.map((photo, index) => {
            const number = index + 1;
            return (
              <li
                key={"kept" in photo ? `kept-${photo.kept}` : photo.upload}
                className="flex gap-3"
              >
                <a
                  href={photo.url}
                  target="_blank"
                  rel="noreferrer"
                  aria-label={t("workshop.catalog.openPhoto", { number })}
                  className="shrink-0"
                >
                  <img
                    src={photo.url}
                    alt=""
                    loading="lazy"
                    className="size-16 rounded-xl bg-secondary/70 object-cover"
                  />
                </a>
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <Input
                    value={photo.alt}
                    maxLength={ALT_LENGTH}
                    aria-label={t("workshop.catalog.photoAlt", { number })}
                    placeholder={t("workshop.catalog.photoAltPlaceholder")}
                    onChange={(event) => {
                      const alt = event.target.value;
                      onChange((current) =>
                        current.map((other, place) =>
                          place === index ? { ...other, alt } : other,
                        ),
                      );
                    }}
                    className="h-9 text-sm"
                  />
                  <div className="flex items-center gap-1">
                    {index === 0 ? (
                      <Badge variant="gold">
                        {t("workshop.catalog.firstPhoto")}
                      </Badge>
                    ) : null}
                    <span className="flex-1" />
                    <IconButton
                      label={t("workshop.catalog.photoUp", { number })}
                      disabled={index === 0}
                      onClick={() =>
                        onChange((current) => moved(current, index, index - 1))
                      }
                    >
                      <ArrowUp aria-hidden />
                    </IconButton>
                    <IconButton
                      label={t("workshop.catalog.photoDown", { number })}
                      disabled={index === photos.length - 1}
                      onClick={() =>
                        onChange((current) => moved(current, index, index + 1))
                      }
                    >
                      <ArrowDown aria-hidden />
                    </IconButton>
                    <IconButton
                      label={t("workshop.catalog.photoRemove", { number })}
                      onClick={() =>
                        onChange((current) =>
                          current.filter((_, place) => place !== index),
                        )
                      }
                    >
                      <X aria-hidden />
                    </IconButton>
                  </div>
                </div>
              </li>
            );
          })}
          {Array.from({ length: uploading }, (_, index) => (
            <li
              // biome-ignore lint/suspicious/noArrayIndexKey: uploads in flight have nothing else to tell them apart
              key={index}
              className="flex items-center gap-3 text-sm text-muted-foreground"
            >
              <span className="flex size-16 shrink-0 items-center justify-center rounded-xl bg-secondary/70">
                <LoaderCircle className="size-5 animate-spin" aria-hidden />
              </span>
              {t("workshop.catalog.uploading")}
            </li>
          ))}
        </ol>
      ) : (
        <p className="text-sm text-muted-foreground">
          {t("workshop.catalog.noPhotos")}
        </p>
      )}
      <div className="flex flex-col items-start gap-1.5">
        <input
          ref={input}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          hidden
          onChange={(event) => {
            const files = Array.from(event.target.files ?? []);
            // The same photo can be chosen again after it's taken off.
            event.target.value = "";
            onAdd(files);
          }}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={full}
          onClick={() => input.current?.click()}
        >
          <ImagePlus aria-hidden />
          {t("workshop.catalog.addPhotos")}
        </Button>
        <p className="text-xs text-muted-foreground">
          {full
            ? t("workshop.catalog.tooManyPhotos", { count: MOST_PHOTOS })
            : t("workshop.catalog.addPhotosHint")}
        </p>
      </div>
    </section>
  );
}

/**
 * The shop's categories the product is in, as its menu lists them; with
 * more than one, which is its main one.
 */
function CategoriesField({
  chosen,
  shelves,
  onChange,
}: {
  chosen: string[];
  /**
   * Every category it can be in, and those the shop no longer lists, which
   * it can only leave; undefined while they load.
   */
  shelves: { handle: string; title: string; unlisted: boolean }[] | undefined;
  onChange: (change: (chosen: string[]) => string[]) => void;
}) {
  const t = useI18n();
  const id = useId();
  const titleOf = (handle: string) =>
    shelves?.find((shelf) => shelf.handle === handle)?.title ?? handle;
  return (
    <fieldset className="flex flex-col gap-3">
      <legend className="mb-1 font-medium">
        {t("workshop.catalog.categories")}
        <span className="block text-sm font-normal text-muted-foreground">
          {t("workshop.catalog.categoriesHint")}
        </span>
      </legend>
      {shelves ? (
        <ul className="grid grid-cols-2 gap-x-4 gap-y-2">
          {shelves.map((shelf) => {
            const fieldId = `${id}-${shelf.handle}`;
            return (
              <li key={shelf.handle} className="flex items-start gap-2.5">
                <input
                  id={fieldId}
                  type="checkbox"
                  checked={chosen.includes(shelf.handle)}
                  onChange={(event) => {
                    const on = event.target.checked;
                    onChange((current) =>
                      on
                        ? [...current, shelf.handle]
                        : current.filter((handle) => handle !== shelf.handle),
                    );
                  }}
                  className="mt-0.5 size-4 shrink-0 accent-foreground"
                />
                <Label htmlFor={fieldId} className="font-normal leading-snug">
                  {shelf.title}
                  {shelf.unlisted ? (
                    <span className="text-muted-foreground">
                      {" "}
                      {t("workshop.catalog.unlisted")}
                    </span>
                  ) : null}
                </Label>
              </li>
            );
          })}
        </ul>
      ) : (
        <Skeleton className="h-48 rounded-2xl" />
      )}
      {chosen.length > 1 ? (
        <div className="mt-2 flex flex-col gap-1.5">
          <Label htmlFor={`${id}-main`}>
            {t("workshop.catalog.mainCategory")}
          </Label>
          <select
            id={`${id}-main`}
            value={chosen[0]}
            aria-describedby={`${id}-main-hint`}
            onChange={(event) => {
              const main = event.target.value;
              onChange((current) => [
                main,
                ...current.filter((handle) => handle !== main),
              ]);
            }}
            className={selectClass}
          >
            {chosen.map((handle) => (
              <option key={handle} value={handle}>
                {titleOf(handle)}
              </option>
            ))}
          </select>
          <p id={`${id}-main-hint`} className="text-xs text-muted-foreground">
            {t("workshop.catalog.mainCategoryHint")}
          </p>
        </div>
      ) : null}
    </fieldset>
  );
}

/**
 * The order options the product's line asks, in order: each to move or take
 * off, and one of the shop's to add, unless one it asks shares its answer.
 */
function LineOptionsField({
  chosen,
  all,
  onChange,
}: {
  chosen: LineOption[];
  /** Every order option the shop has; undefined while they load. */
  all: LineOption[] | undefined;
  onChange: (change: (chosen: LineOption[]) => LineOption[]) => void;
}) {
  const t = useI18n();
  const format = useFormats();
  const id = useId();
  const [adding, setAdding] = useState("");
  const asked = new Set(chosen.map((option) => option.key));
  const full = chosen.length >= MOST_LINE_OPTIONS;

  /** What an option asks: its choices and what each adds, or what's written. */
  const asks = (option: LineOption) =>
    option.kind === "select"
      ? option.choices
          .map((choice) =>
            choice.price
              ? `${choice.label} (+${format.lei(choice.price)})`
              : choice.label,
          )
          .join(", ")
      : [t(`workshop.catalog.kinds.${option.kind}`), option.hint]
          .filter(Boolean)
          .join(" · ");

  const add = () => {
    const option = all?.find((other) => other.handle === adding);
    if (!option) return;
    onChange((current) =>
      current.some((other) => other.key === option.key)
        ? current
        : [...current, option],
    );
    setAdding("");
  };

  return (
    <fieldset className="flex flex-col gap-3">
      <legend className="mb-1 text-sm font-medium">
        {t("workshop.catalog.lineOptions")}
        <span className="block font-normal text-muted-foreground">
          {t("workshop.catalog.lineOptionsHint")}
        </span>
      </legend>
      {chosen.length > 0 ? (
        <ol className="flex flex-col divide-y rounded-2xl border">
          {chosen.map((option, index) => (
            <li key={option.handle} className="flex items-start gap-3 p-3">
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <p className="text-sm font-medium">
                  {option.label}
                  {option.required ? (
                    <Badge variant="outline" className="ml-2 align-middle">
                      {t("workshop.catalog.required")}
                    </Badge>
                  ) : null}
                </p>
                <p className="line-clamp-2 text-xs text-muted-foreground">
                  {asks(option)}
                </p>
              </div>
              <div className="flex shrink-0 items-center">
                <IconButton
                  label={t("workshop.catalog.lineOptionUp", {
                    label: option.label,
                  })}
                  disabled={index === 0}
                  onClick={() =>
                    onChange((current) => moved(current, index, index - 1))
                  }
                >
                  <ArrowUp aria-hidden />
                </IconButton>
                <IconButton
                  label={t("workshop.catalog.lineOptionDown", {
                    label: option.label,
                  })}
                  disabled={index === chosen.length - 1}
                  onClick={() =>
                    onChange((current) => moved(current, index, index + 1))
                  }
                >
                  <ArrowDown aria-hidden />
                </IconButton>
                <IconButton
                  label={t("workshop.catalog.lineOptionRemove", {
                    label: option.label,
                  })}
                  onClick={() =>
                    onChange((current) =>
                      current.filter((other) => other.handle !== option.handle),
                    )
                  }
                >
                  <X aria-hidden />
                </IconButton>
              </div>
            </li>
          ))}
        </ol>
      ) : (
        <p className="text-sm text-muted-foreground">
          {t("workshop.catalog.noLineOptions")}
        </p>
      )}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`${id}-add`} className="font-normal">
          {t("workshop.catalog.addLineOption")}
        </Label>
        <div className="flex gap-2">
          <select
            id={`${id}-add`}
            value={adding}
            disabled={!all || full}
            aria-describedby={`${id}-add-hint`}
            onChange={(event) => setAdding(event.target.value)}
            className={selectClass}
          >
            <option value="">{t("workshop.catalog.chooseLineOption")}</option>
            {all?.map((option) => {
              const line = `${option.label}${
                option.required ? ` (${t("workshop.catalog.required")})` : ""
              }: ${asks(option)}`;
              return (
                <option
                  key={option.handle}
                  value={option.handle}
                  disabled={asked.has(option.key)}
                >
                  {line.length > ASKS_SHOWN
                    ? `${line.slice(0, ASKS_SHOWN - 1)}…`
                    : line}
                </option>
              );
            })}
          </select>
          <Button
            type="button"
            variant="outline"
            disabled={!adding || full}
            onClick={add}
          >
            {t("workshop.catalog.add")}
          </Button>
        </div>
        <p id={`${id}-add-hint`} className="text-xs text-muted-foreground">
          {full
            ? t("workshop.catalog.tooManyLineOptions", {
                count: MOST_LINE_OPTIONS,
              })
            : t("workshop.catalog.addLineOptionHint")}
        </p>
      </div>
    </fieldset>
  );
}
