"use client";

import { LENGTHS, MAX_SEATS } from "@jolene/backend/convex/invites/rules";
import type { HouseholdInput } from "@jolene/backend/convex/invites/validators";
import { fieldsFor, type Occasion } from "@jolene/design";
import { type Locale, localeNames, locales } from "@jolene/i18n";
import { Button } from "@jolene/ui/button";
import { Input } from "@jolene/ui/input";
import { Label } from "@jolene/ui/label";
import { LoaderCircle } from "lucide-react";
import { type FormEvent, useId, useState } from "react";
import { errorCode } from "@/lib/convex-error";
import type { Household } from "@/lib/guest-list";
import { useCurrentLocale, useI18n } from "@/locales/client";

const selectClass =
  "h-10 w-full min-w-0 rounded-lg border border-input bg-card px-3 text-[15px] shadow-xs outline-none transition-[border-color,box-shadow] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/30";

/** Whose guests a family is, named as the couple are: "Ana's", "Mihai's". */
export function useSideLabel(
  occasion: Occasion,
  fields: Record<string, string>,
) {
  const t = useI18n();
  const locale = useCurrentLocale();
  const definitions = fieldsFor(occasion);
  return (side: Household["side"]) => {
    if (!side) return "";
    if (side === "both") return t("invite.both");
    return fields[side]?.trim() || definitions[side]?.labels[locale] || "";
  };
}

/**
 * A family on the guest list, as the couple writes them: the name on their
 * invitation, how many they are, whether they may bring someone, and how to
 * reach them. Adds a family, or changes one.
 */
export function HouseholdForm({
  occasion,
  fields,
  household,
  onSubmit,
  onCancel,
}: {
  occasion: Occasion;
  fields: Record<string, string>;
  household?: Household;
  onSubmit: (household: HouseholdInput) => Promise<void>;
  onCancel: () => void;
}) {
  const t = useI18n();
  const id = useId();
  const sideLabel = useSideLabel(occasion, fields);
  const [name, setName] = useState(household?.name ?? "");
  const [seats, setSeats] = useState(String(household?.seats ?? 2));
  const [plusOne, setPlusOne] = useState(household?.plusOne ?? false);
  const [side, setSide] = useState<Household["side"]>(household?.side);
  const [phone, setPhone] = useState(household?.phone ?? "");
  const [email, setEmail] = useState(household?.email ?? "");
  const [language, setLanguage] = useState<Locale | undefined>(
    household?.language,
  );
  const [note, setNote] = useState(household?.note ?? "");
  const [pending, setPending] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setPending(true);
    setProblem(null);
    try {
      await onSubmit({
        name,
        seats: Math.min(MAX_SEATS, Math.max(1, Number(seats) || 1)),
        plusOne,
        ...(side ? { side } : {}),
        ...(phone.trim() ? { phone } : {}),
        ...(email.trim() ? { email } : {}),
        ...(language ? { language } : {}),
        ...(note.trim() ? { note } : {}),
      });
    } catch (error) {
      const code = errorCode(error);
      setProblem(
        code === "too-many-households"
          ? t("invite.tooManyFamilies")
          : code === "invalid-input"
            ? t("invite.invalid")
            : t("common.error"),
      );
    } finally {
      setPending(false);
    }
  };

  return (
    <form
      onSubmit={submit}
      className="grid gap-4 rounded-2xl border border-border/80 bg-background p-4 sm:grid-cols-6"
    >
      <div className="flex flex-col gap-2 sm:col-span-4">
        <Label htmlFor={`${id}-name`}>{t("invite.familyName")}</Label>
        <Input
          id={`${id}-name`}
          value={name}
          required
          autoFocus
          maxLength={LENGTHS.name}
          placeholder={t("invite.familyNamePlaceholder")}
          onChange={(event) => setName(event.target.value)}
        />
      </div>
      <div className="flex flex-col gap-2 sm:col-span-2">
        <Label htmlFor={`${id}-seats`}>{t("invite.seats")}</Label>
        <Input
          id={`${id}-seats`}
          type="number"
          inputMode="numeric"
          min={1}
          max={MAX_SEATS}
          value={seats}
          onChange={(event) => setSeats(event.target.value)}
        />
      </div>
      <div className="flex flex-col gap-2 sm:col-span-3">
        <Label htmlFor={`${id}-phone`}>{t("invite.phone")}</Label>
        <Input
          id={`${id}-phone`}
          type="tel"
          value={phone}
          maxLength={LENGTHS.phone}
          placeholder="07xx xxx xxx"
          onChange={(event) => setPhone(event.target.value)}
        />
      </div>
      <div className="flex flex-col gap-2 sm:col-span-3">
        <Label htmlFor={`${id}-email`}>{t("invite.email")}</Label>
        <Input
          id={`${id}-email`}
          type="email"
          value={email}
          maxLength={LENGTHS.email}
          onChange={(event) => setEmail(event.target.value)}
        />
      </div>
      {occasion === "wedding" ? (
        <div className="flex flex-col gap-2 sm:col-span-2">
          <Label htmlFor={`${id}-side`}>{t("invite.side")}</Label>
          <select
            id={`${id}-side`}
            value={side ?? ""}
            onChange={(event) =>
              setSide((event.target.value || undefined) as Household["side"])
            }
            className={selectClass}
          >
            <option value="" />
            <option value="partner1">{sideLabel("partner1")}</option>
            <option value="partner2">{sideLabel("partner2")}</option>
            <option value="both">{sideLabel("both")}</option>
          </select>
        </div>
      ) : null}
      <div className="flex flex-col gap-2 sm:col-span-2">
        <Label htmlFor={`${id}-language`}>{t("invite.guestLanguage")}</Label>
        <select
          id={`${id}-language`}
          value={language ?? ""}
          onChange={(event) =>
            setLanguage((event.target.value || undefined) as Locale | undefined)
          }
          className={selectClass}
        >
          <option value="">{t("invite.sameLanguage")}</option>
          {locales.map((locale) => (
            <option key={locale} value={locale}>
              {localeNames[locale]}
            </option>
          ))}
        </select>
      </div>
      <label className="flex items-center gap-2 self-end pb-2.5 text-sm sm:col-span-2">
        <input
          type="checkbox"
          checked={plusOne}
          onChange={(event) => setPlusOne(event.target.checked)}
          className="size-4 accent-[var(--color-primary)]"
        />
        {t("invite.plusOne")}
      </label>
      <div className="flex flex-col gap-2 sm:col-span-6">
        <Label htmlFor={`${id}-note`}>{t("invite.familyNote")}</Label>
        <Input
          id={`${id}-note`}
          value={note}
          maxLength={LENGTHS.householdNote}
          onChange={(event) => setNote(event.target.value)}
        />
      </div>
      {problem ? (
        <p role="alert" className="text-sm text-destructive sm:col-span-6">
          {problem}
        </p>
      ) : null}
      <div className="flex gap-2 sm:col-span-6">
        <Button type="submit" disabled={pending}>
          {pending ? (
            <LoaderCircle className="animate-spin" aria-hidden />
          ) : null}
          {household ? t("invite.save") : t("invite.add")}
        </Button>
        <Button type="button" variant="ghost" onClick={onCancel}>
          {t("invite.cancel")}
        </Button>
      </div>
    </form>
  );
}
