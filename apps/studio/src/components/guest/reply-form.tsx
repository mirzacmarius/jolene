"use client";

import { LENGTHS, MAX_SEATS } from "@jolene/backend/convex/invites/rules";
import type {
  Questions,
  Reply,
  ReplyInput,
} from "@jolene/backend/convex/invites/validators";
import { Button } from "@jolene/ui/button";
import { Input } from "@jolene/ui/input";
import { Label } from "@jolene/ui/label";
import { Textarea } from "@jolene/ui/textarea";
import { cn } from "@jolene/ui/utils";
import { LoaderCircle, Plus, X } from "lucide-react";
import { type FormEvent, useId, useRef, useState } from "react";
import { errorCode } from "@/lib/convex-error";
import { useI18n } from "@/locales/client";

/** Who a reply is for: a family on the list, as the couple invited them. */
export interface ReplyFamily {
  name: string;
  seats: number;
  plusOne: boolean;
}

interface GuestDraft {
  key: number;
  name: string;
  child: boolean;
  meal: string;
  plusOne: boolean;
}

const selectClass =
  "h-10 w-full min-w-0 rounded-lg border border-input bg-card px-3 text-[15px] shadow-xs outline-none transition-[border-color,box-shadow] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/30";

/**
 * The reply to an invitation: whether the family comes, who, with their
 * menus, and a few words. Guests fill it on their page; the couple notes a
 * reply they took on the phone with the same form. Through the open link it
 * asks the family's name too, and up to MAX_SEATS people.
 */
export function ReplyForm({
  family,
  questions,
  hosts,
  initial,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  /** Null through the open link, where the family writes their name. */
  family: ReplyFamily | null;
  questions: Questions;
  hosts: string;
  initial?: Reply | null;
  submitLabel?: string;
  onSubmit: (reply: ReplyInput, name: string) => Promise<void>;
  onCancel?: () => void;
}) {
  const t = useI18n();
  const id = useId();
  const next = useRef(0);
  const draft = (guest?: Partial<GuestDraft>): GuestDraft => ({
    key: next.current++,
    name: "",
    child: false,
    meal: "",
    plusOne: false,
    ...guest,
  });
  const seats = family?.seats ?? MAX_SEATS;
  const [name, setName] = useState("");
  const [coming, setComing] = useState<boolean | null>(
    initial ? initial.coming : null,
  );
  const [guests, setGuests] = useState<GuestDraft[]>(() => {
    const replied = initial?.coming ? initial.guests : [];
    if (replied.length > 0)
      return replied.map((guest) =>
        draft({
          name: guest.name,
          child: guest.child,
          meal: guest.meal ?? "",
          plusOne: Boolean(guest.plusOne),
        }),
      );
    // A family of one is the person named on the invitation.
    const count = family ? family.seats : 1;
    return Array.from({ length: count }, () =>
      draft({ name: family?.seats === 1 ? family.name : "" }),
    );
  });
  const [allergies, setAllergies] = useState(initial?.allergies ?? "");
  const [message, setMessage] = useState(initial?.message ?? "");
  const [pending, setPending] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  const invited = guests.filter((guest) => !guest.plusOne);
  const plusOne = guests.find((guest) => guest.plusOne);
  const change = (key: number, patch: Partial<GuestDraft>) =>
    setGuests((current) =>
      current.map((guest) =>
        guest.key === key ? { ...guest, ...patch } : guest,
      ),
    );
  const remove = (key: number) =>
    setGuests((current) => current.filter((guest) => guest.key !== key));

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (coming === null) return;
    if (!family && !name.trim()) {
      setProblem(t("guest.yourName"));
      return;
    }
    setPending(true);
    setProblem(null);
    try {
      await onSubmit(
        {
          coming,
          guests: coming
            ? guests.map((guest) => ({
                name: guest.name.trim(),
                child: guest.child,
                ...(guest.meal ? { meal: guest.meal } : {}),
                ...(guest.plusOne ? { plusOne: true as const } : {}),
              }))
            : [],
          ...(coming && questions.allergies && allergies.trim()
            ? { allergies: allergies.trim() }
            : {}),
          ...(message.trim() ? { message: message.trim() } : {}),
        },
        name.trim(),
      );
    } catch (error) {
      const code = errorCode(error);
      setProblem(
        code === "too-many"
          ? t("guest.tooMany")
          : code === "invalid-input"
            ? t("guest.invalid")
            : t("guest.error"),
      );
    } finally {
      setPending(false);
    }
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-6">
      {family ? null : (
        <div className="flex flex-col gap-2">
          <Label htmlFor={`${id}-name`}>{t("guest.yourName")}</Label>
          <Input
            id={`${id}-name`}
            value={name}
            maxLength={LENGTHS.name}
            autoComplete="name"
            required
            onChange={(event) => setName(event.target.value)}
          />
        </div>
      )}

      <fieldset className="grid gap-3 sm:grid-cols-2">
        <legend className="sr-only">{t("guest.replyTitle")}</legend>
        {[true, false].map((answer) => (
          <label
            key={String(answer)}
            className={cn(
              "cursor-pointer rounded-2xl border px-5 py-4 text-base transition-colors has-[:focus-visible]:ring-[3px] has-[:focus-visible]:ring-ring/40",
              coming === answer
                ? "border-primary bg-primary text-primary-foreground"
                : "border-input bg-card hover:bg-accent",
            )}
          >
            <input
              type="radio"
              name={`${id}-coming`}
              checked={coming === answer}
              onChange={() => {
                setComing(answer);
                if (answer && guests.length === 0) setGuests([draft()]);
              }}
              className="sr-only"
            />
            {answer ? t("guest.yes") : t("guest.no")}
          </label>
        ))}
      </fieldset>

      {coming ? (
        <fieldset className="flex flex-col gap-4">
          <legend className="mb-3 font-display text-2xl">
            {t("guest.who")}
          </legend>
          {guests.map((guest, index) => (
            <div
              key={guest.key}
              className="grid gap-3 rounded-2xl border border-border/80 bg-card p-4 sm:grid-cols-[minmax(0,1fr)_auto]"
            >
              <div className="flex flex-col gap-2">
                <Label htmlFor={`${id}-guest-${guest.key}`}>
                  {guest.plusOne
                    ? t("guest.plusOneName")
                    : t("guest.person", { number: index + 1 })}
                </Label>
                <Input
                  id={`${id}-guest-${guest.key}`}
                  value={guest.name}
                  maxLength={LENGTHS.guestName}
                  placeholder={t("guest.name")}
                  onChange={(event) =>
                    change(guest.key, { name: event.target.value })
                  }
                />
              </div>
              <div className="flex flex-wrap items-end gap-3">
                {questions.meals.length > 0 ? (
                  <div className="flex min-w-44 flex-1 flex-col gap-2">
                    <Label htmlFor={`${id}-meal-${guest.key}`}>
                      {t("guest.meal")}
                    </Label>
                    <select
                      id={`${id}-meal-${guest.key}`}
                      value={guest.meal}
                      onChange={(event) =>
                        change(guest.key, { meal: event.target.value })
                      }
                      className={selectClass}
                    >
                      <option value="">{t("guest.chooseMeal")}</option>
                      {questions.meals.map((meal) => (
                        <option key={meal} value={meal}>
                          {meal}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : null}
                <label className="flex h-10 items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={guest.child}
                    onChange={(event) =>
                      change(guest.key, { child: event.target.checked })
                    }
                    className="size-4 accent-[var(--color-primary)]"
                  />
                  {t("guest.child")}
                </label>
                {guests.length > 1 ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={t("guest.remove")}
                    title={t("guest.remove")}
                    onClick={() => remove(guest.key)}
                  >
                    <X aria-hidden />
                  </Button>
                ) : null}
              </div>
            </div>
          ))}
          <div className="flex flex-wrap items-center gap-4">
            {invited.length < seats ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() =>
                  setGuests((current) => {
                    // Before the plus-one, who comes as the family's guest.
                    const at = current.findIndex((guest) => guest.plusOne);
                    if (at === -1) return [...current, draft()];
                    return [
                      ...current.slice(0, at),
                      draft(),
                      ...current.slice(at),
                    ];
                  })
                }
              >
                <Plus aria-hidden />
                {t("guest.addPerson")}
              </Button>
            ) : null}
            {family?.plusOne ? (
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={Boolean(plusOne)}
                  onChange={(event) =>
                    event.target.checked
                      ? setGuests((current) => [
                          ...current,
                          draft({ plusOne: true }),
                        ])
                      : plusOne && remove(plusOne.key)
                  }
                  className="size-4 accent-[var(--color-primary)]"
                />
                {t("guest.plusOne")}
              </label>
            ) : null}
          </div>
          {questions.allergies ? (
            <div className="flex flex-col gap-2">
              <Label htmlFor={`${id}-allergies`}>{t("guest.allergies")}</Label>
              <Input
                id={`${id}-allergies`}
                value={allergies}
                maxLength={LENGTHS.allergies}
                onChange={(event) => setAllergies(event.target.value)}
              />
            </div>
          ) : null}
        </fieldset>
      ) : null}

      {coming !== null ? (
        <div className="flex flex-col gap-2">
          <Label htmlFor={`${id}-message`}>
            {hosts ? t("guest.message", { hosts }) : t("guest.messageUnnamed")}
          </Label>
          <Textarea
            id={`${id}-message`}
            value={message}
            maxLength={LENGTHS.message}
            rows={3}
            onChange={(event) => setMessage(event.target.value)}
          />
        </div>
      ) : null}

      {problem ? (
        <p role="alert" className="text-sm text-destructive">
          {problem}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" size="lg" disabled={coming === null || pending}>
          {pending ? (
            <LoaderCircle className="animate-spin" aria-hidden />
          ) : null}
          {pending ? t("guest.sending") : (submitLabel ?? t("guest.send"))}
        </Button>
        {onCancel ? (
          <Button type="button" variant="ghost" onClick={onCancel}>
            {t("invite.cancel")}
          </Button>
        ) : null}
      </div>
    </form>
  );
}

/** A reply as a line: who comes, or that they don't. */
export function useReplyLine() {
  const t = useI18n();
  return (reply: Reply) => {
    if (!reply.coming) return t("guest.notComing");
    const names = reply.guests.map((guest) => guest.name).filter(Boolean);
    return names.length === reply.guests.length
      ? t("guest.coming", { names: names.join(", ") })
      : t("guest.comingCount", { count: reply.guests.length });
  };
}
