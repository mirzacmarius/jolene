"use client";

import { api } from "@jolene/backend/convex/_generated/api";
import { orderNumber } from "@jolene/backend/convex/orders/format";
import { productKindLabels } from "@jolene/design";
import { Badge } from "@jolene/ui/badge";
import { Skeleton } from "@jolene/ui/skeleton";
import { useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { ExternalLink } from "lucide-react";
import type { ReactNode } from "react";
import { useCurrentLocale, useI18n } from "@/locales/client";
import { useFormats } from "./formats";
import { PrintFile } from "./print-file";

type Order = NonNullable<FunctionReturnType<typeof api.workshop.order>>;
type Line = Order["lines"][number];

/**
 * One order, for the workshop to make and send: each line with its proof
 * and print file, what the customer chose and wrote, who paid and where it
 * goes, and what it cost.
 */
export function OrderView({ name }: { name: string }) {
  const t = useI18n();
  const format = useFormats();
  const number = orderNumber(name);
  const order = useQuery(
    api.workshop.order,
    number === null ? "skip" : { number },
  );
  if (number === null || order === null)
    return (
      <p className="rounded-3xl border border-dashed p-10 text-muted-foreground">
        {t("workshop.notFound", { name })}
      </p>
    );
  if (order === undefined)
    return (
      <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <Skeleton className="h-96 rounded-3xl" />
        <Skeleton className="h-64 rounded-3xl" />
      </div>
    );
  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
        <p className="text-muted-foreground">
          {t("workshop.paidAt", { date: format.time(order.paidAt) })}
        </p>
        {order.test ? (
          <Badge variant="outline">{t("workshop.test")}</Badge>
        ) : null}
        <div className="flex flex-wrap gap-x-5 gap-y-1 text-sm sm:ml-auto">
          {order.page ? (
            <OutLink href={order.page}>{t("workshop.orderPage")}</OutLink>
          ) : null}
          {order.payment ? (
            <OutLink href={order.payment}>{t("workshop.payment")}</OutLink>
          ) : null}
        </div>
      </div>
      <div className="grid items-start gap-10 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <ul className="flex flex-col divide-y rounded-3xl border bg-card">
          {order.lines.map((line, index) => (
            <OrderLine
              // An order's lines never change, so their places name them.
              // biome-ignore lint/suspicious/noArrayIndexKey: see above
              key={index}
              line={line}
              index={index}
              order={order.name}
            />
          ))}
        </ul>
        <aside className="flex flex-col gap-8">
          <Customer order={order} />
          <Totals order={order} />
        </aside>
      </div>
    </div>
  );
}

function OutLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="inline-flex items-center gap-1.5 text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
    >
      {children}
      <ExternalLink className="size-3.5" aria-hidden />
    </a>
  );
}

function OrderLine({
  line,
  index,
  order,
}: {
  line: Line;
  index: number;
  order: string;
}) {
  const t = useI18n();
  const locale = useCurrentLocale();
  const format = useFormats();
  // The couple's design shows what to make; a product's photo, what it is.
  const picture = line.proof
    ? line.proof.image && {
        url: line.proof.image,
        alt: [
          productKindLabels[line.proof.kind][locale],
          line.proof.suite[locale],
        ]
          .filter(Boolean)
          .join(" · "),
      }
    : line.image;
  const chosen = [
    ...line.options.map(({ name, value }) => ({
      key: `option:${name}`,
      label: name,
      value,
    })),
    ...line.answers.map(({ key, label, value }) => ({
      key: `answer:${key}`,
      label,
      value,
    })),
  ];
  return (
    <li className="flex flex-col gap-5 p-5 sm:flex-row sm:p-6">
      <figure className="w-28 shrink-0 sm:w-40">
        {picture ? (
          <a href={picture.url} target="_blank" rel="noreferrer">
            <img
              src={picture.url}
              alt={picture.alt}
              loading="lazy"
              className="aspect-[4/5] w-full rounded-2xl bg-secondary/70 object-contain"
            />
          </a>
        ) : (
          <div className="flex aspect-[4/5] w-full items-center justify-center rounded-2xl bg-secondary/70 text-sm text-muted-foreground">
            {t("workshop.noPicture")}
          </div>
        )}
        {line.proof ? (
          <figcaption className="mt-2 text-xs text-muted-foreground">
            {t("workshop.proof", { date: format.day(line.proof.approvedAt) })}
          </figcaption>
        ) : null}
      </figure>
      <div className="flex min-w-0 flex-1 flex-col gap-3">
        <div>
          <h3 className="text-lg font-medium">{line.title}</h3>
          <p className="text-sm text-muted-foreground">
            {[
              t("workshop.quantity", { count: line.quantity }),
              t("workshop.price", { price: format.lei(line.price) }),
              format.lei(line.total),
            ].join(" · ")}
          </p>
          {line.event ? (
            <p className="mt-1 text-sm">
              {t("workshop.forEvent", { hosts: line.event.hosts })}
            </p>
          ) : null}
        </div>
        {chosen.length > 0 ? (
          <dl className="grid gap-x-6 gap-y-1 text-sm sm:grid-cols-[max-content_1fr]">
            {chosen.map(({ key, label, value }) => (
              <div key={key} className="contents">
                <dt className="text-muted-foreground">{label}</dt>
                <dd className="whitespace-pre-line break-words">{value}</dd>
              </div>
            ))}
          </dl>
        ) : null}
        {line.proof === null ? (
          <p className="text-sm text-destructive">{t("workshop.proofGone")}</p>
        ) : null}
        {line.proof ? <PrintFile order={order} line={index} /> : null}
      </div>
    </li>
  );
}

function Customer({ order }: { order: Order }) {
  const t = useI18n();
  const format = useFormats();
  const { customer, address } = order;
  return (
    <>
      <section className="text-sm">
        <h3 className="font-medium text-muted-foreground">
          {t("workshop.customer")}
        </h3>
        <p className="mt-2 text-base">{customer.name}</p>
        <p>
          <a
            href={`mailto:${customer.email}`}
            className="underline-offset-4 hover:underline"
          >
            {customer.email}
          </a>
        </p>
        {customer.phone ? (
          <p>
            <a
              href={`tel:${customer.phone}`}
              className="underline-offset-4 hover:underline"
            >
              {customer.phone}
            </a>
          </p>
        ) : null}
        <p className="mt-2 text-muted-foreground">
          {t("workshop.language", {
            language:
              order.language === "ro"
                ? t("workshop.languages.ro")
                : t("workshop.languages.en"),
          })}
        </p>
      </section>
      <section className="text-sm">
        <h3 className="font-medium text-muted-foreground">
          {t("workshop.address")}
        </h3>
        {address ? (
          <address className="mt-2 not-italic">
            {Object.entries({
              name: address.name,
              line1: address.line1,
              line2: address.line2,
              city: [address.postalCode, address.city]
                .filter(Boolean)
                .join(" "),
              county: address.county,
              country: format.country(address.country),
            }).map(([key, part]) =>
              part ? (
                <span key={key} className="block">
                  {part}
                </span>
              ) : null,
            )}
          </address>
        ) : (
          <p className="mt-2">{t("workshop.nothingTravels")}</p>
        )}
        {order.delivery ? (
          <p className="mt-2 text-muted-foreground">
            {t("workshop.delivery", { label: order.delivery.label })}
          </p>
        ) : null}
      </section>
    </>
  );
}

function Totals({ order }: { order: Order }) {
  const t = useI18n();
  const format = useFormats();
  const rows = [
    ...order.fees.map((fee) => ({
      key: `fee:${fee.key}`,
      label: fee.label,
      amount: fee.price,
    })),
    { key: "subtotal", label: t("workshop.subtotal"), amount: order.subtotal },
    ...(order.delivery
      ? [
          {
            key: "delivery",
            label: order.delivery.label,
            amount: order.delivery.price,
          },
        ]
      : []),
    ...(order.discount > 0
      ? [
          {
            key: "discount",
            label: t("workshop.discount"),
            amount: -order.discount,
          },
        ]
      : []),
  ];
  return (
    <section className="rounded-3xl border bg-card p-5 text-sm">
      <dl className="grid grid-cols-[1fr_auto] gap-y-1.5">
        {rows.map(({ key, label, amount }) => (
          <div key={key} className="contents">
            <dt className="text-muted-foreground">{label}</dt>
            <dd className="pl-4 text-right">{format.lei(amount)}</dd>
          </div>
        ))}
        <dt className="mt-2 border-t pt-2 font-medium">
          {t("workshop.total")}
        </dt>
        <dd className="mt-2 border-t pt-2 pl-4 text-right font-medium">
          {format.lei(order.total)}
        </dd>
      </dl>
      {order.vat !== undefined ? (
        <p className="mt-1 text-right text-xs text-muted-foreground">
          {t("workshop.vat", { amount: format.lei(order.vat) })}
        </p>
      ) : null}
    </section>
  );
}
