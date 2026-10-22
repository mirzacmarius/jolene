"use client";

import { useAuthToken } from "@convex-dev/auth/react";
import { api } from "@jolene/backend/convex/_generated/api";
import { type Look, sameLook } from "@jolene/design";
import { Badge } from "@jolene/ui/badge";
import { Button } from "@jolene/ui/button";
import { Input } from "@jolene/ui/input";
import { Label } from "@jolene/ui/label";
import { Skeleton } from "@jolene/ui/skeleton";
import { toast } from "@jolene/ui/toaster";
import { useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { ArrowDown, ArrowUp, ExternalLink, X } from "lucide-react";
import { type FormEvent, type KeyboardEvent, useId, useState } from "react";
import { errorCode } from "@/lib/convex-error";
import { leiField, parseLei } from "@/lib/lei";
import { moved } from "@/lib/lists";
import { refreshShop } from "@/lib/shop";
import { useCurrentLocale, useI18n } from "@/locales/client";
import { useAsks } from "./asks";
import {
  ChoiceLookField,
  type LookDraft,
  lookDraft,
  readLook,
} from "./choice-look";
import { useFormats } from "./formats";
import { IconButton } from "./icon-button";

type LineOption = NonNullable<
  FunctionReturnType<typeof api.workshop.lineOptions.option>
>;

type Locale = ReturnType<typeof useCurrentLocale>;

/** The longest an option's name, or a choice's, can be (workshop.lineOptions.save). */
const LABEL_LENGTH = 100;

/** The longest the line under an option's name can be (workshop.lineOptions.save). */
const HINT_LENGTH = 300;

/** The most choices an option can have (workshop.lineOptions.save). */
const MOST_CHOICES = 40;

/** The most a choice can add, in bani (workshop.lineOptions.save). */
const MOST_BANI = 10_000_000;

/** How many of the products that ask it the page lists before the others. */
const PRODUCTS_SHOWN = 8;

/** A choice in the form, with what it adds in lei, as typed. */
interface ChoiceDraft {
  /** The form's own key for it, which moves with it. */
  key: string;
  label: string;
  price: string;
  /** How the studio shows it; null on an option asked in words. */
  look: LookDraft | null;
}

/** The option's fields as the form shows them. */
interface Draft {
  label: string;
  hint: string;
  required: boolean;
  choices: ChoiceDraft[];
}

/** What the form saves, as the page compares it with the option. */
interface Values {
  label: string;
  hint: string;
  required: boolean;
  choices: { label: string; price: number; look: Look | null }[];
}

type ChoiceProblem = "empty" | "long" | "twice";

const draftOf = (option: LineOption, locale: Locale): Draft => ({
  label: option.label,
  hint: option.hint ?? "",
  required: option.required,
  choices: option.choices.map((choice, index) => ({
    key: `choice-${index}`,
    label: choice.label,
    price: leiField(choice.price, locale),
    look: option.shows ? lookDraft(option.shows, choice.look, locale) : null,
  })),
});

const valuesOf = (option: LineOption): Values => ({
  label: option.label,
  hint: option.hint ?? "",
  required: option.required,
  choices: option.choices,
});

/** An option's version: what the form shows of it, and when it changed. */
const versionOf = (option: LineOption) =>
  JSON.stringify([option.editedAt, valuesOf(option)]);

const sameValues = (values: Values | null, option: LineOption) =>
  values !== null &&
  values.label === option.label &&
  values.hint === (option.hint ?? "") &&
  values.required === option.required &&
  values.choices.length === option.choices.length &&
  values.choices.every((choice, index) => {
    const was = option.choices[index];
    return (
      was !== undefined &&
      choice.label === was.label &&
      choice.price === was.price &&
      sameLook(choice.look, was.look)
    );
  });

/** A choice's name as the option compares it with its others'. */
const nameOf = (label: string) => label.trim().toLocaleLowerCase("ro");

/**
 * The draft as it would be saved, and what's wrong with each field, if
 * anything: values only when nothing is.
 */
function readDraft(draft: Draft) {
  const label = draft.label.trim();
  const hint = draft.hint.trim();
  const named = new Map<string, number>();
  for (const choice of draft.choices)
    named.set(nameOf(choice.label), (named.get(nameOf(choice.label)) ?? 0) + 1);
  const names = new Map<string, ChoiceProblem>();
  const prices = new Set<string>();
  const looks = new Set<string>();
  const choices: Values["choices"] = [];
  for (const choice of draft.choices) {
    const name = choice.label.trim();
    const price = parseLei(choice.price);
    const look = choice.look ? readLook(choice.look) : null;
    if (!name) names.set(choice.key, "empty");
    else if (name.length > LABEL_LENGTH) names.set(choice.key, "long");
    else if ((named.get(nameOf(name)) ?? 0) > 1) names.set(choice.key, "twice");
    if (price === null || price > MOST_BANI) prices.add(choice.key);
    if (look === undefined) looks.add(choice.key);
    if (price !== null && price <= MOST_BANI && look !== undefined)
      choices.push({ label: name, price, look });
  }
  const problems = {
    label: label === "" || label.length > LABEL_LENGTH,
    hint: hint.length > HINT_LENGTH,
    names,
    prices,
    looks,
  };
  const values: Values | null =
    !problems.label &&
    !problems.hint &&
    names.size === 0 &&
    prices.size === 0 &&
    looks.size === 0
      ? { label, hint, required: draft.required, choices }
      : null;
  return { problems, values };
}

/**
 * One of the shop's order options, for the workshop to change on every
 * product that asks it: its name, the line under it, whether it must be
 * answered, and a select's choices with what each adds and, on an option
 * that changes a design, how the studio shows each.
 */
export function LineOptionView({ handle }: { handle: string }) {
  const t = useI18n();
  const option = useQuery(api.workshop.lineOptions.option, { handle });
  if (option === undefined)
    return (
      <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <Skeleton className="h-96 rounded-3xl" />
        <Skeleton className="h-64 rounded-3xl" />
      </div>
    );
  if (option === null)
    return (
      <p className="rounded-3xl border border-dashed p-10 text-muted-foreground">
        {t("workshop.lineOptions.notFound")}
      </p>
    );
  return <LineOptionEditor live={option} />;
}

/**
 * The form, from the version of the option it started from. While nothing
 * is changed in it, it follows the option as it changes; once something is,
 * it says when someone else changes the option, which saving would refuse.
 */
function LineOptionEditor({ live }: { live: LineOption }) {
  const t = useI18n();
  const locale = useCurrentLocale();
  const format = useFormats();
  const id = useId();
  const token = useAuthToken();
  const save = useMutation(api.workshop.lineOptions.save);
  const [base, setBase] = useState(live);
  const [draft, setDraft] = useState(() => draftOf(live, locale));
  const [adding, setAdding] = useState("");
  const [busy, setBusy] = useState(false);
  const { problems, values } = readDraft(draft);
  const changed = !sameValues(values, base);
  const select = base.kind === "select";
  const full = draft.choices.length >= MOST_CHOICES;
  // What a cart that holds the option can no longer keep: a choice gone,
  // or no answer where one is now needed.
  const kept = new Set(draft.choices.map((choice) => choice.label.trim()));
  const lost = base.choices.some((choice) => !kept.has(choice.label));
  const nowRequired = draft.required && !base.required;

  const follow = (option: LineOption) => {
    setBase(option);
    setDraft(draftOf(option, locale));
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
      if (errorCode(error) === "line-option-changed") {
        toast.error(t("workshop.lineOptions.changed"));
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

  const changeChoices = (change: (choices: ChoiceDraft[]) => ChoiceDraft[]) =>
    setDraft((current) => ({ ...current, choices: change(current.choices) }));

  const add = () => {
    const label = adding.trim();
    if (!label || full) return;
    changeChoices((current) => [
      ...current,
      {
        key: `new-${crypto.randomUUID()}`,
        label,
        price: leiField(0, locale),
        // A new choice shows nothing in the studio until it's given a look.
        look: base.shows ? lookDraft(base.shows, null, locale) : null,
      },
    ]);
    setAdding("");
  };

  // Enter in the new choice's name adds it, rather than saving the option.
  const addOnEnter = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== "Enter" || event.nativeEvent.isComposing) return;
    event.preventDefault();
    add();
  };

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-3">
        <h1 className="font-display text-5xl">{live.label}</h1>
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
          <Badge variant="outline">
            {t(`workshop.catalog.kinds.${live.kind}`)}
          </Badge>
          <span className="text-muted-foreground">
            {live.editedAt !== null && live.editedBy !== null
              ? t("workshop.lineOptions.editedBy", {
                  email: live.editedBy,
                  time: format.time(live.editedAt),
                })
              : t("workshop.lineOptions.asSeeded")}
          </span>
        </div>
      </div>
      <form onSubmit={submit} className="flex flex-col gap-6">
        {stale ? (
          <div
            role="status"
            className="flex flex-col items-start gap-3 rounded-2xl border border-gold/40 bg-gold/10 p-4 text-sm"
          >
            <p>{t("workshop.lineOptions.changedMeanwhile")}</p>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => follow(live)}
            >
              {t("workshop.lineOptions.showTheirs")}
            </Button>
          </div>
        ) : null}
        <div className="grid items-start gap-10 lg:grid-cols-[minmax(0,1fr)_20rem]">
          <div className="flex min-w-0 flex-col gap-6 rounded-3xl border bg-card p-5 sm:p-6">
            <div className="flex flex-col gap-2">
              <Label htmlFor={`${id}-label`}>
                {t("workshop.lineOptions.name")}
              </Label>
              <Input
                id={`${id}-label`}
                value={draft.label}
                maxLength={LABEL_LENGTH + 20}
                aria-invalid={problems.label || undefined}
                aria-describedby={
                  problems.label ? `${id}-label-hint` : undefined
                }
                onChange={(event) => {
                  const label = event.target.value;
                  setDraft((current) => ({ ...current, label }));
                }}
              />
              {problems.label ? (
                <p id={`${id}-label-hint`} className="text-xs text-destructive">
                  {t("workshop.lineOptions.problems.name")}
                </p>
              ) : null}
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor={`${id}-hint`}>
                {t("workshop.lineOptions.hint")}
              </Label>
              <Input
                id={`${id}-hint`}
                value={draft.hint}
                maxLength={HINT_LENGTH + 20}
                aria-invalid={problems.hint || undefined}
                aria-describedby={`${id}-hint-hint`}
                onChange={(event) => {
                  const hint = event.target.value;
                  setDraft((current) => ({ ...current, hint }));
                }}
              />
              <p
                id={`${id}-hint-hint`}
                className={
                  problems.hint
                    ? "text-xs text-destructive"
                    : "text-xs text-muted-foreground"
                }
              >
                {problems.hint
                  ? t("workshop.lineOptions.problems.hint")
                  : t("workshop.lineOptions.hintHint")}
              </p>
            </div>
            <div className="flex items-start gap-3 rounded-2xl bg-secondary/50 p-4">
              <input
                id={`${id}-required`}
                type="checkbox"
                checked={draft.required}
                onChange={(event) => {
                  const required = event.target.checked;
                  setDraft((current) => ({ ...current, required }));
                }}
                aria-describedby={`${id}-required-hint`}
                className="mt-1 size-4 shrink-0 accent-foreground"
              />
              <div className="flex flex-col gap-1">
                <Label htmlFor={`${id}-required`}>
                  {t("workshop.lineOptions.required")}
                </Label>
                <p
                  id={`${id}-required-hint`}
                  className="text-sm text-muted-foreground"
                >
                  {select
                    ? draft.required
                      ? t("workshop.lineOptions.requiredSelect")
                      : t("workshop.lineOptions.optionalSelect")
                    : draft.required
                      ? t("workshop.lineOptions.requiredWritten")
                      : t("workshop.lineOptions.optionalWritten")}
                </p>
              </div>
            </div>
            {select ? (
              <fieldset className="flex flex-col gap-3">
                <legend className="mb-1 text-sm font-medium">
                  {t("workshop.lineOptions.choices")}
                  <span className="block font-normal text-muted-foreground">
                    {t("workshop.lineOptions.choicesHint")}
                  </span>
                  {base.shows ? (
                    <span className="mt-1 block font-normal text-muted-foreground">
                      {t("workshop.lineOptions.looks.hint")}
                    </span>
                  ) : null}
                </legend>
                <ol className="flex flex-col divide-y rounded-2xl border">
                  {draft.choices.map((choice, index) => {
                    const number = index + 1;
                    const name = problems.names.get(choice.key);
                    const price = problems.prices.has(choice.key);
                    const nameId = `${id}-${choice.key}-name`;
                    const priceId = `${id}-${choice.key}-price`;
                    return (
                      <li
                        key={choice.key}
                        className="flex flex-wrap items-start gap-x-3 gap-y-2 p-3"
                      >
                        <span className="w-6 shrink-0 pt-2.5 text-right text-sm text-muted-foreground tabular-nums">
                          {number}
                        </span>
                        <div className="flex min-w-0 flex-1 basis-40 flex-col gap-1.5">
                          <Input
                            value={choice.label}
                            maxLength={LABEL_LENGTH + 20}
                            aria-label={t("workshop.lineOptions.choiceName", {
                              number,
                            })}
                            aria-invalid={name ? true : undefined}
                            aria-describedby={name ? nameId : undefined}
                            onChange={(event) => {
                              const label = event.target.value;
                              changeChoices((current) =>
                                current.map((other) =>
                                  other.key === choice.key
                                    ? { ...other, label }
                                    : other,
                                ),
                              );
                            }}
                          />
                          {name ? (
                            <p id={nameId} className="text-xs text-destructive">
                              {t(`workshop.lineOptions.problems.${name}`)}
                            </p>
                          ) : null}
                        </div>
                        <div className="flex w-32 flex-col gap-1.5">
                          <div className="flex items-center gap-2">
                            <Input
                              value={choice.price}
                              inputMode="decimal"
                              autoComplete="off"
                              aria-label={t(
                                "workshop.lineOptions.choicePrice",
                                { number },
                              )}
                              aria-invalid={price || undefined}
                              aria-describedby={price ? priceId : undefined}
                              onChange={(event) => {
                                const text = event.target.value;
                                changeChoices((current) =>
                                  current.map((other) =>
                                    other.key === choice.key
                                      ? { ...other, price: text }
                                      : other,
                                  ),
                                );
                              }}
                            />
                            <span
                              className="text-sm text-muted-foreground"
                              aria-hidden
                            >
                              lei
                            </span>
                          </div>
                          {price ? (
                            <p
                              id={priceId}
                              className="text-xs text-destructive"
                            >
                              {t("workshop.lineOptions.problems.price")}
                            </p>
                          ) : null}
                        </div>
                        <div className="ml-auto flex shrink-0 items-center pt-1">
                          <IconButton
                            label={t("workshop.lineOptions.up", { number })}
                            disabled={index === 0}
                            onClick={() =>
                              changeChoices((current) =>
                                moved(current, index, index - 1),
                              )
                            }
                          >
                            <ArrowUp aria-hidden />
                          </IconButton>
                          <IconButton
                            label={t("workshop.lineOptions.down", { number })}
                            disabled={index === draft.choices.length - 1}
                            onClick={() =>
                              changeChoices((current) =>
                                moved(current, index, index + 1),
                              )
                            }
                          >
                            <ArrowDown aria-hidden />
                          </IconButton>
                          <IconButton
                            label={t("workshop.lineOptions.remove", {
                              number,
                            })}
                            // A select keeps a choice at least.
                            disabled={draft.choices.length === 1}
                            onClick={() =>
                              changeChoices((current) =>
                                current.filter(
                                  (other) => other.key !== choice.key,
                                ),
                              )
                            }
                          >
                            <X aria-hidden />
                          </IconButton>
                        </div>
                        {base.shows && choice.look ? (
                          <ChoiceLookField
                            kind={base.shows}
                            number={number}
                            draft={choice.look}
                            onChange={(look) =>
                              changeChoices((current) =>
                                current.map((other) =>
                                  other.key === choice.key
                                    ? { ...other, look }
                                    : other,
                                ),
                              )
                            }
                          />
                        ) : null}
                      </li>
                    );
                  })}
                </ol>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor={`${id}-add`} className="font-normal">
                    {t("workshop.lineOptions.add")}
                  </Label>
                  <div className="flex gap-2">
                    <Input
                      id={`${id}-add`}
                      value={adding}
                      maxLength={LABEL_LENGTH + 20}
                      disabled={full}
                      placeholder={t("workshop.lineOptions.addPlaceholder")}
                      aria-describedby={`${id}-add-hint`}
                      onChange={(event) => setAdding(event.target.value)}
                      onKeyDown={addOnEnter}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      disabled={!adding.trim() || full}
                      onClick={add}
                    >
                      {t("workshop.catalog.add")}
                    </Button>
                  </div>
                  <p
                    id={`${id}-add-hint`}
                    className="text-xs text-muted-foreground"
                  >
                    {full
                      ? t("workshop.lineOptions.tooMany", {
                          count: MOST_CHOICES,
                        })
                      : t("workshop.lineOptions.addHint")}
                  </p>
                </div>
              </fieldset>
            ) : null}
          </div>
          <div className="flex min-w-0 flex-col gap-8">
            <AskedBy products={live.products} />
            {live.sharing.length > 0 ? (
              <Sharing options={live.sharing} />
            ) : null}
          </div>
        </div>
        {changed && (lost || nowRequired) ? (
          <div
            role="status"
            className="flex flex-col gap-1 rounded-2xl border border-gold/40 bg-gold/10 p-4 text-sm"
          >
            {lost ? <p>{t("workshop.lineOptions.lostChoices")}</p> : null}
            {nowRequired ? (
              <p>{t("workshop.lineOptions.nowRequired")}</p>
            ) : null}
            <p className="text-muted-foreground">
              {t("workshop.lineOptions.paidOrders")}
            </p>
          </div>
        ) : null}
        <div className="sticky bottom-0 z-10 -mx-2 flex flex-wrap items-center gap-2 border-t bg-background/95 px-2 py-3 backdrop-blur supports-[backdrop-filter]:bg-background/80">
          <Button type="submit" disabled={busy || !changed || !values || stale}>
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

/** A link to another of the workshop's pages, in a new tab: the form stays. */
function Aside({ href, children }: { href: string; children: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="inline-flex items-center gap-1 underline-offset-4 hover:underline"
    >
      {children}
      <ExternalLink className="size-3 text-muted-foreground" aria-hidden />
    </a>
  );
}

/**
 * The products that ask the option, those for sale first: the first few,
 * and the others on asking.
 */
function AskedBy({ products }: { products: LineOption["products"] }) {
  const t = useI18n();
  const id = useId();
  const item = (product: LineOption["products"][number]) => (
    <li key={product.handle}>
      <Aside
        href={`/studio/atelier/produse/${encodeURIComponent(product.handle)}`}
      >
        {product.title}
      </Aside>
      {product.published ? null : (
        <span className="text-muted-foreground">
          {" "}
          {t("workshop.lineOptions.offSale")}
        </span>
      )}
    </li>
  );
  const shown = products.slice(0, PRODUCTS_SHOWN);
  const others = products.slice(PRODUCTS_SHOWN);
  return (
    <section aria-labelledby={`${id}-title`} className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <h2 id={`${id}-title`} className="font-medium">
          {t("workshop.lineOptions.askedBy", { count: products.length })}
        </h2>
        <p className="text-sm text-muted-foreground">
          {products.length > 0
            ? t("workshop.lineOptions.askedByHint")
            : t("workshop.lineOptions.noProducts")}
        </p>
      </div>
      {shown.length > 0 ? (
        <ul className="flex flex-col gap-1.5 text-sm">{shown.map(item)}</ul>
      ) : null}
      {others.length > 0 ? (
        <details className="text-sm">
          <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
            {t("workshop.lineOptions.otherProducts", { count: others.length })}
          </summary>
          <ul className="mt-1.5 flex flex-col gap-1.5">{others.map(item)}</ul>
        </details>
      ) : null}
    </section>
  );
}

/** The other options that ask the same, each with its choices and prices. */
function Sharing({ options }: { options: LineOption["sharing"] }) {
  const t = useI18n();
  const asks = useAsks();
  const id = useId();
  return (
    <section aria-labelledby={`${id}-title`} className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <h2 id={`${id}-title`} className="font-medium">
          {t("workshop.lineOptions.sharing")}
        </h2>
        <p className="text-sm text-muted-foreground">
          {t("workshop.lineOptions.sharingHint")}
        </p>
      </div>
      <ul className="flex flex-col gap-3 text-sm">
        {options.map((option) => (
          <li key={option.handle} className="flex flex-col gap-0.5">
            <span>
              <Aside
                href={`/studio/atelier/optiuni/${encodeURIComponent(option.handle)}`}
              >
                {option.label}
              </Aside>
              {option.required ? (
                <Badge variant="outline" className="ml-2 align-middle">
                  {t("workshop.catalog.required")}
                </Badge>
              ) : null}
            </span>
            <span className="line-clamp-2 text-xs text-muted-foreground">
              {asks(option)}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
