"use client";

import { api } from "@jolene/backend/convex/_generated/api";
import { Badge } from "@jolene/ui/badge";
import { Button } from "@jolene/ui/button";
import { toast } from "@jolene/ui/toaster";
import { useMutation } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { ExternalLink, LoaderCircle } from "lucide-react";
import { useState } from "react";
import { useI18n } from "@/locales/client";
import { useStuck } from "./stuck";

type Order = NonNullable<FunctionReturnType<typeof api.workshop.order>>;
type Invoice = NonNullable<Order["invoice"]>;

/**
 * The order's invoice, which SmartBill issues once it's paid, and the
 * credit note that reverses it after a full refund, each with its PDF; and
 * asking SmartBill again for an invoice it refused, never heard of, or left
 * unanswered for a quarter of an hour.
 */
export function InvoicePanel({
  order,
  number,
}: {
  order: Order;
  number: number;
}) {
  const t = useI18n();
  const retry = useMutation(api.invoices.retry);
  const { invoice, creditNote } = order;
  const stuck = useStuck(
    invoice?.status === "issuing" ? invoice.at : undefined,
  );
  const [asking, setAsking] = useState(false);
  const askable =
    order.invoicing && (!invoice || invoice.status === "failed" || stuck);
  const ask = async () => {
    setAsking(true);
    try {
      toast(
        (await retry({ number }))
          ? t("workshop.invoice.asked")
          : t("workshop.invoice.notAsked"),
      );
    } catch {
      toast.error(t("common.error"));
    } finally {
      setAsking(false);
    }
  };
  return (
    <section className="text-sm">
      <h3 className="font-medium text-muted-foreground">
        {t("workshop.invoice.title")}
      </h3>
      <div className="mt-2 flex flex-col gap-2">
        {invoice ? (
          <Document document={invoice} kind="invoice" stuck={stuck} />
        ) : (
          <p>
            {order.invoicing
              ? t("workshop.invoice.none")
              : t("workshop.invoice.unavailable")}
          </p>
        )}
        {creditNote ? (
          <Document document={creditNote} kind="creditNote" stuck={false} />
        ) : null}
      </div>
      {askable ? (
        <Button
          size="sm"
          variant="outline"
          className="mt-3"
          disabled={asking}
          onClick={() => void ask()}
        >
          {invoice ? t("workshop.invoice.again") : t("workshop.invoice.issue")}
        </Button>
      ) : null}
    </section>
  );
}

/** An invoice or a credit note, as far as SmartBill has got with it. */
function Document({
  document,
  kind,
  stuck,
}: {
  document: Invoice;
  kind: "invoice" | "creditNote";
  /** SmartBill has left it unanswered for a quarter of an hour. */
  stuck: boolean;
}) {
  const t = useI18n();
  const invoice = kind === "invoice";
  if (document.status === "issued") {
    const name = t(
      invoice ? "workshop.invoice.issued" : "workshop.invoice.creditNote",
      { name: document.name ?? "" },
    );
    return (
      <div className="flex flex-col gap-1">
        <p className="flex flex-wrap items-center gap-2">
          {document.url ? (
            <a
              href={document.url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 underline-offset-4 hover:underline"
            >
              {name}
              <ExternalLink className="size-3.5" aria-hidden />
            </a>
          ) : (
            name
          )}
          {document.draft ? (
            <Badge variant="outline">{t("workshop.invoice.draft")}</Badge>
          ) : null}
        </p>
        {document.warning ? (
          <p className="break-words text-destructive">{document.warning}</p>
        ) : null}
      </div>
    );
  }
  if (document.status === "issuing")
    return stuck ? (
      <p className="text-destructive">{t("workshop.invoice.stuck")}</p>
    ) : (
      <p className="flex items-center gap-2">
        <LoaderCircle className="size-4 animate-spin" aria-hidden />
        {invoice
          ? t("workshop.invoice.issuing")
          : t("workshop.invoice.creditNoteIssuing")}
      </p>
    );
  return (
    <div>
      <p className="text-destructive">
        {invoice
          ? t("workshop.invoice.failed")
          : t("workshop.invoice.creditNoteFailed")}
      </p>
      {document.error ? (
        <p className="mt-1 break-words text-muted-foreground">
          {document.error}
        </p>
      ) : null}
    </div>
  );
}
