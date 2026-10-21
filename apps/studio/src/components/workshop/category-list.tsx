"use client";

import { useAuthToken } from "@convex-dev/auth/react";
import { api } from "@jolene/backend/convex/_generated/api";
import { Button } from "@jolene/ui/button";
import { Input } from "@jolene/ui/input";
import { Label } from "@jolene/ui/label";
import { Skeleton } from "@jolene/ui/skeleton";
import { toast } from "@jolene/ui/toaster";
import { useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { ArrowDown, ArrowUp, ExternalLink, X } from "lucide-react";
import Link from "next/link";
import { type FormEvent, type KeyboardEvent, useId, useState } from "react";
import { errorCode } from "@/lib/convex-error";
import { moved } from "@/lib/lists";
import { refreshShop } from "@/lib/shop";
import { useI18n } from "@/locales/client";
import { useFormats } from "./formats";
import { IconButton } from "./icon-button";

type List = FunctionReturnType<typeof api.workshop.categories.list>;

type Shelf = List["categories"][number];

/** The longest name a category can have (workshop.categories.save). */
const TITLE_LENGTH = 100;

/** The most categories the shop can have (workshop.categories.save). */
const MOST_CATEGORIES = 100;

/** A category in the form: one the shop has, or a new one, with no address yet. */
interface Row {
  /** Its address, or the form's own key for a new one. */
  key: string;
  title: string;
  /** The category as the shop has it; none for a new one. */
  shelf?: Shelf;
}

type Problem = "empty" | "long" | "twice";

const rowsOf = (list: List): Row[] =>
  list.categories.map((shelf) => ({
    key: shelf.handle,
    title: shelf.title,
    shelf,
  }));

/** A name as the shop compares it with the others'. */
const nameOf = (title: string) => title.trim().toLocaleLowerCase("ro");

/**
 * Whether the form holds the list as it is: its categories, in its order,
 * with its names. A new one matches the category it became once saved.
 */
const sameAs = (rows: Row[], list: List) =>
  rows.length === list.categories.length &&
  rows.every((row, index) => {
    const shelf = list.categories[index];
    return (
      shelf !== undefined &&
      row.title.trim() === shelf.title &&
      (row.shelf === undefined || row.shelf.handle === shelf.handle)
    );
  });

/** What's wrong with each row's name, by its key. */
function problemsOf(rows: Row[]) {
  const named = new Map<string, number>();
  for (const { title } of rows)
    named.set(nameOf(title), (named.get(nameOf(title)) ?? 0) + 1);
  const problems = new Map<string, Problem>();
  for (const { key, title } of rows) {
    const name = title.trim();
    if (!name) problems.set(key, "empty");
    else if (name.length > TITLE_LENGTH) problems.set(key, "long");
    else if ((named.get(nameOf(title)) ?? 0) > 1) problems.set(key, "twice");
  }
  return problems;
}

/**
 * The shop's categories, in the order its pages list them, for the workshop
 * to rename, reorder and add to.
 */
export function CategoryList() {
  const list = useQuery(api.workshop.categories.list);
  if (list === undefined) return <Skeleton className="h-96 rounded-3xl" />;
  return <CategoryEditor live={list} />;
}

/**
 * The form, from the version of the list it started from. While nothing is
 * changed in it, it follows the list as it changes; once something is, it
 * says when someone else changes the list, which saving would refuse.
 */
function CategoryEditor({ live }: { live: List }) {
  const t = useI18n();
  const format = useFormats();
  const id = useId();
  const token = useAuthToken();
  const save = useMutation(api.workshop.categories.save);
  const [base, setBase] = useState(live);
  const [rows, setRows] = useState(() => rowsOf(live));
  const [adding, setAdding] = useState("");
  const [busy, setBusy] = useState(false);
  const problems = problemsOf(rows);
  const changed = !sameAs(rows, base);
  const full = rows.length >= MOST_CATEGORIES;
  // Their counts as they are now, which change with the products on them.
  const now = new Map(live.categories.map((shelf) => [shelf.handle, shelf]));

  const follow = (list: List) => {
    setBase(list);
    setRows(rowsOf(list));
  };
  // A newer version: taken up when the form holds nothing it would lose.
  if (live.version !== base.version && (!changed || sameAs(rows, live)))
    follow(live);
  const stale = live.version !== base.version;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!changed || stale || problems.size > 0) return;
    setBusy(true);
    try {
      await save({
        version: base.version,
        categories: rows.map(({ shelf, title }) =>
          shelf
            ? { handle: shelf.handle, title: title.trim() }
            : { title: title.trim() },
        ),
      });
    } catch (error) {
      if (errorCode(error) === "categories-changed") {
        toast.error(t("workshop.categories.changed"));
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

  const add = () => {
    const title = adding.trim();
    if (!title || full) return;
    setRows((current) => [
      ...current,
      { key: `new-${crypto.randomUUID()}`, title },
    ]);
    setAdding("");
  };

  // Enter in the new category's name adds it, rather than saving the list.
  const addOnEnter = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== "Enter" || event.nativeEvent.isComposing) return;
    event.preventDefault();
    add();
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-6">
      <p className="text-sm text-muted-foreground">
        {live.editedAt !== null && live.editedBy !== null
          ? t("workshop.categories.editedBy", {
              email: live.editedBy,
              time: format.time(live.editedAt),
            })
          : t("workshop.categories.asSeeded")}
      </p>
      {stale ? (
        <div
          role="status"
          className="flex flex-col items-start gap-3 rounded-2xl border border-gold/40 bg-gold/10 p-4 text-sm"
        >
          <p>{t("workshop.categories.changedMeanwhile")}</p>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => follow(live)}
          >
            {t("workshop.categories.showTheirs")}
          </Button>
        </div>
      ) : null}
      <ol className="flex flex-col divide-y rounded-3xl border bg-card">
        {rows.map((row, index) => {
          const number = index + 1;
          const shelf = row.shelf && (now.get(row.shelf.handle) ?? row.shelf);
          const problem = problems.get(row.key);
          const problemId = `${id}-${row.key}-problem`;
          return (
            <li key={row.key} className="flex items-start gap-3 p-3 sm:px-5">
              <span className="w-6 shrink-0 pt-2.5 text-right text-sm text-muted-foreground tabular-nums">
                {number}
              </span>
              <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                <Input
                  value={row.title}
                  maxLength={TITLE_LENGTH + 20}
                  aria-label={t("workshop.categories.name", { number })}
                  aria-invalid={problem ? true : undefined}
                  aria-describedby={problem ? problemId : undefined}
                  onChange={(event) => {
                    const title = event.target.value;
                    setRows((current) =>
                      current.map((other) =>
                        other.key === row.key ? { ...other, title } : other,
                      ),
                    );
                  }}
                />
                {problem ? (
                  <p id={problemId} className="text-xs text-destructive">
                    {t(`workshop.categories.problems.${problem}`)}
                  </p>
                ) : null}
                <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                  {shelf ? (
                    <>
                      <Link
                        href={`/studio/atelier/produse?categorie=${encodeURIComponent(shelf.handle)}`}
                        className="underline-offset-4 hover:text-foreground hover:underline"
                      >
                        {shelf.more
                          ? t("workshop.categories.forSaleMore", {
                              count: shelf.forSale,
                            })
                          : t("workshop.categories.forSale", {
                              count: shelf.forSale,
                            })}
                      </Link>
                      {shelf.forSale === 0 ? (
                        <span>{t("workshop.categories.hidden")}</span>
                      ) : shelf.page ? (
                        <a
                          href={shelf.page}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 underline-offset-4 hover:text-foreground hover:underline"
                        >
                          /collections/{shelf.handle}
                          <ExternalLink className="size-3" aria-hidden />
                        </a>
                      ) : (
                        <span>/collections/{shelf.handle}</span>
                      )}
                    </>
                  ) : (
                    <span>{t("workshop.categories.new")}</span>
                  )}
                </p>
              </div>
              <div className="flex shrink-0 items-center pt-1">
                <IconButton
                  label={t("workshop.categories.up", { number })}
                  disabled={index === 0}
                  onClick={() =>
                    setRows((current) => moved(current, index, index - 1))
                  }
                >
                  <ArrowUp aria-hidden />
                </IconButton>
                <IconButton
                  label={t("workshop.categories.down", { number })}
                  disabled={index === rows.length - 1}
                  onClick={() =>
                    setRows((current) => moved(current, index, index + 1))
                  }
                >
                  <ArrowDown aria-hidden />
                </IconButton>
                {row.shelf ? (
                  // The shop keeps every category it has: its address may be linked.
                  <span className="size-8" aria-hidden />
                ) : (
                  <IconButton
                    label={t("workshop.categories.remove", { number })}
                    onClick={() =>
                      setRows((current) =>
                        current.filter((other) => other.key !== row.key),
                      )
                    }
                  >
                    <X aria-hidden />
                  </IconButton>
                )}
              </div>
            </li>
          );
        })}
      </ol>
      <div className="flex max-w-xl flex-col gap-1.5">
        <Label htmlFor={`${id}-add`}>{t("workshop.categories.add")}</Label>
        <div className="flex gap-2">
          <Input
            id={`${id}-add`}
            value={adding}
            maxLength={TITLE_LENGTH + 20}
            disabled={full}
            placeholder={t("workshop.categories.addPlaceholder")}
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
        <p id={`${id}-add-hint`} className="text-xs text-muted-foreground">
          {full
            ? t("workshop.categories.tooMany", { count: MOST_CATEGORIES })
            : t("workshop.categories.addHint")}
        </p>
      </div>
      <div className="sticky bottom-0 z-10 -mx-2 flex flex-wrap items-center gap-2 border-t bg-background/95 px-2 py-3 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <Button
          type="submit"
          disabled={busy || !changed || problems.size > 0 || stale}
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
        {changed && !stale ? (
          <span className="text-sm text-muted-foreground">
            {t("workshop.catalog.unsaved")}
          </span>
        ) : null}
      </div>
    </form>
  );
}
