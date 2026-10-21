"use client";

import { api } from "@jolene/backend/convex/_generated/api";
import { LENGTHS, MAX_MEALS } from "@jolene/backend/convex/invites/rules";
import { type Locale, localeNames, locales } from "@jolene/i18n";
import { Button } from "@jolene/ui/button";
import { Input } from "@jolene/ui/input";
import { Label } from "@jolene/ui/label";
import { Textarea } from "@jolene/ui/textarea";
import { toast } from "@jolene/ui/toaster";
import { useMutation } from "convex/react";
import { Check, Copy, Plus, X } from "lucide-react";
import { type FormEvent, useId, useState } from "react";
import { errorCode } from "@/lib/convex-error";
import { inviteLink } from "@/lib/invite-links";
import { useI18n } from "@/locales/client";
import type { Dashboard, Invite } from "./types";

/** Copies text, showing "Copied" on the button for a moment. */
export function useCopy() {
  const [copied, setCopied] = useState<string | null>(null);
  const copy = async (text: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(text);
    setTimeout(
      () => setCopied((current) => (current === text ? null : current)),
      1800,
    );
  };
  return { copied, copy };
}

const selectClass =
  "h-10 w-full min-w-0 rounded-lg border border-input bg-card px-3 text-[15px] shadow-xs outline-none transition-[border-color,box-shadow] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/30";

/** The invitation's address, which the couple can make their own. */
function Address({ data, invite }: { data: Dashboard; invite: Invite }) {
  const t = useI18n();
  const id = useId();
  const setSlug = useMutation(api.invites.setSlug);
  const update = useMutation(api.invites.update);
  const { copied, copy } = useCopy();
  const [editing, setEditing] = useState(false);
  const [slug, setSlugText] = useState(invite.slug);
  const [problem, setProblem] = useState<string | null>(null);
  if (!data.base)
    return (
      <p className="text-sm text-muted-foreground">{t("invite.noAddress")}</p>
    );
  const link = inviteLink(data.base, invite.slug);

  const save = async (event: FormEvent) => {
    event.preventDefault();
    setProblem(null);
    try {
      await setSlug({ inviteId: invite._id, slug });
      setEditing(false);
    } catch (error) {
      const code = errorCode(error);
      setProblem(
        code === "slug-taken"
          ? t("invite.slugTaken")
          : code === "invalid-slug"
            ? t("invite.invalidSlug")
            : t("common.error"),
      );
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor={`${id}-slug`}>{t("invite.address")}</Label>
        {editing ? (
          <form onSubmit={save} className="flex flex-col gap-3">
            <div className="flex items-center gap-1 text-sm">
              <span className="truncate text-muted-foreground">
                {data.base}/
              </span>
              <Input
                id={`${id}-slug`}
                value={slug}
                autoFocus
                maxLength={48}
                onChange={(event) =>
                  setSlugText(
                    event.target.value.toLowerCase().replace(/\s+/g, "-"),
                  )
                }
                className="h-9"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              {t("invite.addressWarning")}
            </p>
            {problem ? (
              <p role="alert" className="text-sm text-destructive">
                {problem}
              </p>
            ) : null}
            <div className="flex gap-2">
              <Button type="submit" size="sm">
                {t("invite.save")}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => {
                  setEditing(false);
                  setSlugText(invite.slug);
                  setProblem(null);
                }}
              >
                {t("invite.cancel")}
              </Button>
            </div>
          </form>
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            <code
              id={`${id}-slug`}
              className="min-w-0 flex-1 truncate rounded-lg bg-secondary px-3 py-2 text-[13px]"
            >
              {link}
            </code>
            <Button size="sm" variant="outline" onClick={() => void copy(link)}>
              {copied === link ? <Check aria-hidden /> : <Copy aria-hidden />}
              {copied === link ? t("invite.copied") : t("invite.copy")}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setEditing(true)}>
              {t("invite.change")}
            </Button>
          </div>
        )}
      </div>
      <label className="flex items-start gap-3">
        <input
          type="checkbox"
          checked={invite.open}
          onChange={(event) =>
            void update({
              inviteId: invite._id,
              open: event.target.checked,
            }).catch(() => toast.error(t("common.error")))
          }
          className="mt-1 size-4 accent-[var(--color-primary)]"
        />
        <span className="flex flex-col gap-0.5">
          <span className="text-sm font-medium">{t("invite.openLink")}</span>
          <span className="text-sm text-muted-foreground">
            {t("invite.openLinkLead")}
          </span>
        </span>
      </label>
    </div>
  );
}

/** What the reply form asks besides who comes: menus and allergies. */
function Questions({ invite }: { invite: Invite }) {
  const t = useI18n();
  const id = useId();
  const update = useMutation(api.invites.update);
  const [meal, setMeal] = useState("");
  const { meals, allergies } = invite.questions;
  const save = (questions: typeof invite.questions) =>
    update({ inviteId: invite._id, questions }).catch(() =>
      toast.error(t("common.error")),
    );
  const add = (event: FormEvent) => {
    event.preventDefault();
    const name = meal.trim();
    if (!name) return;
    const known = meals.some(
      (entry) => entry.toLocaleLowerCase() === name.toLocaleLowerCase(),
    );
    if (!known) void save({ meals: [...meals, name], allergies });
    setMeal("");
  };
  return (
    <div className="flex flex-col gap-4">
      <h3 className="font-medium">{t("invite.questions")}</h3>
      <div className="flex flex-col gap-2">
        <p className="text-sm">{t("invite.meals")}</p>
        {meals.length > 0 ? (
          <ul className="flex flex-wrap gap-2">
            {meals.map((name) => (
              <li
                key={name}
                className="flex items-center gap-1 rounded-full bg-secondary py-1 pr-1 pl-3 text-[13px]"
              >
                {name}
                <button
                  type="button"
                  aria-label={t("invite.removeMeal", { meal: name })}
                  title={t("invite.removeMeal", { meal: name })}
                  onClick={() =>
                    void save({
                      meals: meals.filter((entry) => entry !== name),
                      allergies,
                    })
                  }
                  className="rounded-full p-1 text-muted-foreground hover:bg-background hover:text-foreground"
                >
                  <X className="size-3.5" aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">
            {t("invite.mealsLead")}
          </p>
        )}
        {meals.length < MAX_MEALS ? (
          <form onSubmit={add} className="flex gap-2">
            <Input
              id={`${id}-meal`}
              value={meal}
              maxLength={LENGTHS.meal}
              placeholder={t("invite.mealPlaceholder")}
              aria-label={t("invite.addMeal")}
              onChange={(event) => setMeal(event.target.value)}
              className="h-9"
            />
            <Button
              type="submit"
              size="icon"
              variant="outline"
              className="size-9"
              aria-label={t("invite.addMeal")}
              title={t("invite.addMeal")}
            >
              <Plus aria-hidden />
            </Button>
          </form>
        ) : null}
      </div>
      <label className="flex items-center gap-3 text-sm">
        <input
          type="checkbox"
          checked={allergies}
          onChange={(event) =>
            void save({ meals, allergies: event.target.checked })
          }
          className="size-4 accent-[var(--color-primary)]"
        />
        {t("invite.allergies")}
      </label>
    </div>
  );
}

/** The note under the invitation, and the language its page speaks. */
function NoteAndLanguage({ invite }: { invite: Invite }) {
  const t = useI18n();
  const id = useId();
  const update = useMutation(api.invites.update);
  const [note, setNote] = useState(invite.note ?? "");
  const [saved, setSaved] = useState(false);
  const saveNote = async () => {
    if (note.trim() === (invite.note ?? "")) return;
    try {
      await update({ inviteId: invite._id, note });
      setSaved(true);
      setTimeout(() => setSaved(false), 1800);
    } catch {
      toast.error(t("common.error"));
    }
  };
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor={`${id}-note`}>
          {t("invite.note")}
          {saved ? (
            <span className="font-normal text-primary">
              · {t("invite.saved")}
            </span>
          ) : null}
        </Label>
        <Textarea
          id={`${id}-note`}
          value={note}
          maxLength={LENGTHS.note}
          rows={3}
          placeholder={t("invite.notePlaceholder")}
          onChange={(event) => setNote(event.target.value)}
          onBlur={() => void saveNote()}
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor={`${id}-language`}>{t("invite.language")}</Label>
        <select
          id={`${id}-language`}
          value={invite.language}
          onChange={(event) =>
            void update({
              inviteId: invite._id,
              language: event.target.value as Locale,
            }).catch(() => toast.error(t("common.error")))
          }
          className={selectClass}
        >
          {locales.map((locale) => (
            <option key={locale} value={locale}>
              {localeNames[locale]}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}

/**
 * How the invitation reads and opens: its address and open link, what the
 * reply form asks, the note under it and its language.
 */
export function InviteSettings({
  data,
  invite,
}: {
  data: Dashboard;
  invite: Invite;
}) {
  return (
    <section className="flex flex-col gap-6 rounded-3xl border border-border/80 bg-card p-5 sm:p-6">
      <Address data={data} invite={invite} />
      <div className="border-t border-border/70 pt-6">
        <Questions invite={invite} />
      </div>
      <div className="border-t border-border/70 pt-6">
        <NoteAndLanguage invite={invite} />
      </div>
    </section>
  );
}
