"use client";

import { api } from "@jolene/backend/convex/_generated/api";
import { Button } from "@jolene/ui/button";
import { Label } from "@jolene/ui/label";
import { Skeleton } from "@jolene/ui/skeleton";
import { toast } from "@jolene/ui/toaster";
import { useMutation, useQuery } from "convex/react";
import { type FormEvent, useId, useState } from "react";
import { useI18n } from "@/locales/client";
import { useFormats } from "./formats";

const selectClass =
  "h-10 w-full min-w-0 rounded-lg border border-input bg-card px-3 text-[15px] shadow-xs outline-none transition-[border-color,box-shadow] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/30";

/**
 * What the workshop sets for every couple: how many months after its event
 * a guest list is kept (docs/adr/0017).
 */
export function WorkshopSettings() {
  const t = useI18n();
  const format = useFormats();
  const id = useId();
  const settings = useQuery(api.workshop.settings.get, {});
  const save = useMutation(api.workshop.settings.setGuestListMonths);
  /** The months chosen and not saved yet. */
  const [months, setMonths] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  if (settings === undefined)
    return <Skeleton className="h-72 max-w-xl rounded-3xl" />;
  const chosen = months ?? settings.guestListMonths;
  const choices = Array.from(
    { length: settings.maxGuestListMonths - settings.minGuestListMonths + 1 },
    (_, i) => settings.minGuestListMonths + i,
  );

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    try {
      await save({ months: chosen });
      setMonths(null);
      toast(t("workshop.settings.saved"));
    } catch {
      toast.error(t("common.error"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <form
      onSubmit={submit}
      className="flex max-w-xl flex-col gap-5 rounded-3xl border bg-card p-6"
    >
      <div className="flex flex-col gap-2">
        <h2 className="text-lg font-medium">
          {t("workshop.settings.guestLists")}
        </h2>
        <p className="text-sm text-muted-foreground">
          {t("workshop.settings.guestListsLead")}
        </p>
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor={`${id}-months`}>{t("workshop.settings.months")}</Label>
        <select
          id={`${id}-months`}
          value={chosen}
          aria-describedby={`${id}-changed`}
          onChange={(event) => setMonths(Number(event.target.value))}
          className={`${selectClass} sm:w-40`}
        >
          {choices.map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </select>
        <p id={`${id}-changed`} className="text-xs text-muted-foreground">
          {settings.updatedBy && settings.updatedAt
            ? t("workshop.settings.changedBy", {
                email: settings.updatedBy,
                time: format.time(settings.updatedAt),
              })
            : t("workshop.settings.unchanged")}
        </p>
      </div>
      <Button
        type="submit"
        className="self-start"
        disabled={saving || chosen === settings.guestListMonths}
      >
        {t("workshop.settings.save")}
      </Button>
    </form>
  );
}
