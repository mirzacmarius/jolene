"use client";

import { api } from "@jolene/backend/convex/_generated/api";
import { Button } from "@jolene/ui/button";
import { Input } from "@jolene/ui/input";
import { Label } from "@jolene/ui/label";
import { toast } from "@jolene/ui/toaster";
import { useAction } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { type FormEvent, useId, useState } from "react";
import { errorCode } from "@/lib/convex-error";
import { leiField, parseLei } from "@/lib/lei";
import { useCurrentLocale, useI18n } from "@/locales/client";
import { useFormats } from "./formats";

type Order = NonNullable<FunctionReturnType<typeof api.workshop.order>>;

/**
 * Gives money back from the order's payment, all of it or a part, through
 * Stripe: nothing for an order Stripe didn't charge or once it's all given
 * back.
 */
export function RefundPanel({
  order,
  number,
}: {
  order: Order;
  number: number;
}) {
  const t = useI18n();
  const [open, setOpen] = useState(false);
  const left = order.total - order.refunded;
  if (!order.payment || left <= 0) return null;
  return open ? (
    <RefundForm number={number} left={left} onClose={() => setOpen(false)} />
  ) : (
    <Button
      variant="outline"
      size="sm"
      className="self-start"
      onClick={() => setOpen(true)}
    >
      {t("workshop.refunds.open")}
    </Button>
  );
}

function RefundForm({
  number,
  left,
  onClose,
}: {
  number: number;
  /** What's left to give back, in bani. */
  left: number;
  onClose: () => void;
}) {
  const t = useI18n();
  const locale = useCurrentLocale();
  const format = useFormats();
  const id = useId();
  const refund = useAction(api.workshop.refund);
  const [text, setText] = useState(() => leiField(left, locale));
  const [busy, setBusy] = useState(false);
  const amount = parseLei(text);
  const valid = amount !== null && amount > 0 && amount <= left;
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!valid) return;
    setBusy(true);
    try {
      await refund({ number, amount });
      toast.success(t("workshop.refunds.done", { amount: format.lei(amount) }));
      onClose();
    } catch (error) {
      const code = errorCode(error);
      toast.error(
        code === "refund-not-allowed"
          ? t("workshop.refunds.notAllowed")
          : code === "same-refund"
            ? t("workshop.refunds.same")
            : code === "refund-refused"
              ? t("workshop.refunds.refused")
              : code === "invalid-input"
                ? t("workshop.refunds.tooMuch")
                : t("common.error"),
      );
    } finally {
      setBusy(false);
    }
  };
  return (
    <form
      onSubmit={submit}
      aria-label={t("workshop.refunds.title")}
      className="flex flex-col gap-3 rounded-3xl border bg-card p-5 text-sm"
    >
      <h3 className="font-medium">{t("workshop.refunds.title")}</h3>
      <div className="flex flex-col gap-2">
        <Label htmlFor={id}>{t("workshop.refunds.amount")}</Label>
        <Input
          id={id}
          inputMode="decimal"
          autoComplete="off"
          autoFocus
          value={text}
          onChange={(event) => setText(event.target.value)}
          aria-invalid={text.trim() !== "" && !valid}
          aria-describedby={`${id}-most`}
        />
        <p id={`${id}-most`} className="text-xs text-muted-foreground">
          {t("workshop.refunds.most", { amount: format.lei(left) })}
        </p>
      </div>
      <p className="text-xs text-muted-foreground">
        {t("workshop.refunds.card")}
      </p>
      <div className="flex flex-wrap gap-2">
        <Button type="submit" size="sm" disabled={busy || !valid}>
          {valid
            ? t("workshop.refunds.confirm", { amount: format.lei(amount) })
            : t("workshop.refunds.title")}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          disabled={busy}
          onClick={onClose}
        >
          {t("workshop.refunds.keep")}
        </Button>
      </div>
    </form>
  );
}
