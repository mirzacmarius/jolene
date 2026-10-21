"use client";

import { api } from "@jolene/backend/convex/_generated/api";
import type { Id } from "@jolene/backend/convex/_generated/dataModel";
import { LENGTHS, MAX_SEATS } from "@jolene/backend/convex/invites/rules";
import { Button } from "@jolene/ui/button";
import { Label } from "@jolene/ui/label";
import { Textarea } from "@jolene/ui/textarea";
import { useMutation } from "convex/react";
import { LoaderCircle } from "lucide-react";
import { useId, useState } from "react";
import { errorCode } from "@/lib/convex-error";
import { parseFamilies } from "@/lib/guest-list";
import { useI18n } from "@/locales/client";

/** The most families Convex adds in one go (households.add). */
const BATCH = 200;

/**
 * A guest list pasted in: from notes, a message or a spreadsheet, one
 * family a line. What it reads shows before it's added.
 */
export function PasteFamilies({
  inviteId,
  onDone,
}: {
  inviteId: Id<"invites">;
  onDone: () => void;
}) {
  const t = useI18n();
  const id = useId();
  const add = useMutation(api.households.add);
  const [text, setText] = useState("");
  const [pending, setPending] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const families = parseFamilies(text, {
    maxSeats: MAX_SEATS,
    maxName: LENGTHS.name,
  });

  const submit = async () => {
    setPending(true);
    setProblem(null);
    try {
      for (let start = 0; start < families.length; start += BATCH)
        await add({
          inviteId,
          households: families
            .slice(start, start + BATCH)
            .map((family) => ({ ...family, plusOne: false })),
        });
      setText("");
      onDone();
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
    <div className="flex flex-col gap-4 rounded-2xl border border-border/80 bg-background p-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor={`${id}-list`}>{t("invite.paste")}</Label>
        <p className="text-sm text-muted-foreground">{t("invite.pasteLead")}</p>
        <Textarea
          id={`${id}-list`}
          value={text}
          rows={6}
          autoFocus
          placeholder={t("invite.pastePlaceholder")}
          onChange={(event) => setText(event.target.value)}
        />
      </div>
      {families.length > 0 ? (
        <ul className="max-h-60 overflow-y-auto rounded-xl bg-secondary/60 px-4 py-2 text-sm">
          {families.map((family, index) => (
            <li
              // biome-ignore lint/suspicious/noArrayIndexKey: lines of pasted text, read as they are typed
              key={index}
              className="flex flex-wrap gap-x-3 border-b border-border/60 py-1.5 last:border-0"
            >
              <span className="font-medium">{family.name}</span>
              <span className="text-muted-foreground tabular-nums">
                {family.seats}
              </span>
              {family.phone ? (
                <span className="text-muted-foreground">{family.phone}</span>
              ) : null}
              {family.email ? (
                <span className="text-muted-foreground">{family.email}</span>
              ) : null}
              {family.note ? (
                <span className="text-muted-foreground italic">
                  {family.note}
                </span>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
      {problem ? (
        <p role="alert" className="text-sm text-destructive">
          {problem}
        </p>
      ) : null}
      <div className="flex gap-2">
        <Button
          disabled={families.length === 0 || pending}
          onClick={() => void submit()}
        >
          {pending ? (
            <LoaderCircle className="animate-spin" aria-hidden />
          ) : null}
          {t("invite.pasteAdd", { count: families.length })}
        </Button>
        <Button variant="ghost" onClick={onDone}>
          {t("invite.cancel")}
        </Button>
      </div>
    </div>
  );
}
