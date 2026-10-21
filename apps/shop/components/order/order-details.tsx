import Image from "next/image";

import { InviteImage } from "@/components/invite/invite-card";
import { Price } from "@/components/product/price";
import { ProofImage } from "@/components/proof/proof-card";
import { StudioLink } from "@/components/studio/studio-link";
import { ImagePlaceholder } from "@/components/ui/image-placeholder";
import { Link } from "@/components/ui/link";
import { Skeleton } from "@/components/ui/skeleton";
import { shopConfig } from "@/lib/config";
import { formatPrice } from "@/lib/money";
import type { Order, OrderLine } from "@/lib/order/types";

const PAID_FORMAT = new Intl.DateTimeFormat(shopConfig.localization.locale, { dateStyle: "long" });

const SUPPORT_EMAIL = "invitatii.jolene@gmail.com";

export function OrderDetails({ order }: { order: Order }) {
  const cancelled = order.status === "cancelled";
  return (
    <>
      <div className="grid gap-2.5">
        <p className="text-sm text-muted-foreground">
          Comanda {order.name} · {PAID_FORMAT.format(order.paidAt)}
        </p>
        <h1 className="text-3xl sm:text-4xl md:text-5xl">
          {cancelled ? "Comanda a fost anulată" : "Mulțumim, comanda e plătită"}
        </h1>
        {cancelled ? (
          <p className="max-w-2xl text-muted-foreground">
            Nu o mai pregătim. Pentru întrebări, scrieți-ne la{" "}
            <a
              className="text-foreground underline underline-offset-4"
              href={`mailto:${SUPPORT_EMAIL}`}
            >
              {SUPPORT_EMAIL}
            </a>
            , cu numărul ei.
          </p>
        ) : (
          <p className="max-w-2xl text-muted-foreground">
            Confirmarea vine pe email, la {order.customer.email}. Păstrați linkul acestei pagini:
            aici vedeți comanda oricând.
          </p>
        )}
        {order.test ? (
          <p className="text-sm text-amber-800 dark:text-amber-200/90" role="note">
            Comandă de test: plătită în modul de test al Stripe, fără bani reali.
          </p>
        ) : null}
      </div>
      {order.delivery && !cancelled ? <OrderProgress order={order} /> : null}
      <div className="grid gap-10 lg:grid-cols-12">
        <ul
          aria-label="Produse comandate"
          className="grid content-start gap-5 lg:col-span-8 xl:col-span-9"
        >
          {order.lines.map((line, index) => (
            <OrderLineItem key={`${index}-${line.product}`} line={line} />
          ))}
        </ul>
        <aside className="grid content-start gap-10 lg:col-span-4 xl:col-span-3">
          <OrderTotals order={order} />
          {order.pickupAt ? (
            <div className="grid gap-1 text-sm">
              <h2 className="font-medium text-foreground">Ridicați comanda de la atelier</h2>
              <address className="grid text-muted-foreground not-italic">
                <span>{order.pickupAt}</span>
              </address>
              {order.status === "paid" || order.status === "making" ? (
                <p className="text-muted-foreground">Vă anunțăm când e gata de ridicat.</p>
              ) : null}
            </div>
          ) : order.address ? (
            <div className="grid gap-1 text-sm">
              <h2 className="font-medium text-foreground">Livrăm la</h2>
              <address className="grid text-muted-foreground not-italic">
                <span>{order.address.name}</span>
                <span>{order.address.line1}</span>
                {order.address.line2 ? <span>{order.address.line2}</span> : null}
                <span>
                  {[order.address.city, order.address.county, order.address.postalCode]
                    .filter(Boolean)
                    .join(", ")}
                </span>
              </address>
            </div>
          ) : null}
          <p className="text-sm text-muted-foreground">
            Întrebări despre comandă? Scrieți-ne la{" "}
            <a
              className="text-foreground underline underline-offset-4"
              href={`mailto:${SUPPORT_EMAIL}`}
            >
              {SUPPORT_EMAIL}
            </a>
            , cu numărul ei.
          </p>
        </aside>
      </div>
    </>
  );
}

const PROGRESS_NOTES = {
  done: "Curierul a livrat-o.",
  making: "O facem acum în atelier.",
  paid: "Am primit comanda și urmează s-o facem.",
  ready: "E gata: o puteți ridica de la atelier.",
  sent: "Am predat-o curierului și e pe drum.",
} as const;

interface OrderProgressProps {
  order: Order;
}

function OrderProgress({ order }: OrderProgressProps) {
  const pickup = order.delivery?.key === "pickup";
  const steps = [
    { label: "Plătită", status: "paid" },
    { label: "În lucru", status: "making" },
    pickup ? { label: "Gata de ridicat", status: "ready" } : { label: "Expediată", status: "sent" },
    { label: pickup ? "Ridicată" : "Livrată", status: "done" },
  ] as const;
  const current = steps.findIndex((step) => step.status === order.status);
  if (order.status === "cancelled" || current === -1) return null;
  return (
    <section aria-label="Stadiul comenzii" className="grid max-w-2xl gap-2.5">
      <ol className="grid grid-cols-4 gap-2.5">
        {steps.map((step, index) => (
          <li
            aria-current={index === current ? "step" : undefined}
            className="group grid gap-2.5 text-xs text-muted-foreground data-[reached=true]:text-foreground sm:text-sm"
            data-reached={index <= current}
            key={step.status}
          >
            <span className="h-1 bg-border group-data-[reached=true]:bg-foreground" />
            <span className="group-aria-[current=step]:font-medium">{step.label}</span>
          </li>
        ))}
      </ol>
      <p className="text-sm text-muted-foreground">
        {order.status === "done" && pickup
          ? "Ați ridicat-o de la atelier."
          : PROGRESS_NOTES[order.status]}
      </p>
    </section>
  );
}

function OrderLineItem({ line }: { line: OrderLine }) {
  return (
    <li aria-label={line.title} className="flex gap-2.5">
      <div className="relative size-18 shrink-0 self-start overflow-hidden bg-accent">
        {line.event ? (
          <InviteImage className="size-full" event={{ image: line.image?.url ?? null }} />
        ) : line.proof ? (
          <ProofImage className="size-full" fit="cover" proof={line.proof} />
        ) : line.image ? (
          <Image
            alt={line.image.alt || line.title}
            className="object-cover"
            fill
            sizes="100vw"
            src={line.image.url}
          />
        ) : (
          <ImagePlaceholder className="size-full" />
        )}
      </div>
      <div className="grid min-w-0 flex-1 content-start gap-1 pt-0.5">
        <Link
          className="cursor-pointer transition-opacity hover:opacity-70"
          href={
            line.event
              ? `/products/${line.product}?event=${line.event.id}`
              : `/products/${line.product}`
          }
        >
          <h2 className="text-sm font-medium text-foreground">{line.title}</h2>
        </Link>
        {line.options.length ? (
          <p className="text-xs text-muted-foreground">
            {line.options.map((option) => option.value).join(" / ")}
          </p>
        ) : null}
        {line.answers.map((answer) => (
          <p className="text-xs break-words text-muted-foreground" key={answer.key}>
            {answer.label}: {answer.value}
          </p>
        ))}
        {line.proof ? <p className="text-xs text-muted-foreground">Cu designul vostru</p> : null}
        {line.event?.hosts ? (
          <p className="text-xs text-muted-foreground">Pentru {line.event.hosts}</p>
        ) : null}
        <p className="text-xs text-muted-foreground tabular-nums">
          {line.quantity} buc. × {formatPrice(line.price)}
        </p>
        {line.event ? (
          <StudioLink
            className="cursor-pointer justify-self-start text-xs text-foreground underline underline-offset-4 transition-opacity hover:opacity-70"
            path={`/invitatie-digitala/${line.event.id}`}
          >
            Trimiteți invitația din studio
          </StudioLink>
        ) : null}
      </div>
      <Price amount={line.total} className="self-start py-0.5 text-sm font-medium" />
    </li>
  );
}

function OrderTotals({ order }: { order: Order }) {
  const rows = [
    ...order.fees.map((fee) => ({ amount: fee.price, key: fee.key, label: fee.label })),
    { amount: order.subtotal, key: "subtotal", label: "Subtotal" },
    ...(order.delivery
      ? [
          {
            amount: order.delivery.price,
            key: "delivery",
            label: `Livrare: ${order.delivery.label}`,
          },
        ]
      : []),
    ...(order.discount ? [{ amount: -order.discount, key: "discount", label: "Reducere" }] : []),
  ];
  return (
    <div className="grid gap-2.5">
      {rows.map((row) => (
        <div className="flex items-baseline justify-between gap-2.5 text-sm" key={row.key}>
          <span>{row.label}</span>
          {row.key === "delivery" && row.amount === 0 ? (
            <span className="text-sm text-foreground">Gratuit</span>
          ) : (
            <Price amount={row.amount} className="text-sm" />
          )}
        </div>
      ))}
      <div className="flex items-baseline justify-between text-base text-foreground">
        <span>Total plătit</span>
        <Price amount={order.total} className="font-medium text-xl" />
      </div>
      {order.vat ? (
        <div className="flex items-baseline justify-between gap-2.5 text-xs text-muted-foreground">
          <span>Din care TVA</span>
          <Price amount={order.vat} className="text-xs text-muted-foreground" />
        </div>
      ) : null}
      {order.refunded ? (
        <div className="grid gap-1 border-t pt-2.5 text-sm">
          <div className="flex items-baseline justify-between gap-2.5">
            <span>Rambursat pe card</span>
            <Price amount={-order.refunded} className="text-sm" />
          </div>
          <p className="text-xs text-muted-foreground">
            Banii ajung pe card în 5–10 zile lucrătoare de la rambursare.
          </p>
        </div>
      ) : null}
    </div>
  );
}

export function OrderDetailsSkeleton() {
  return (
    <div aria-busy="true" className="grid gap-10">
      <div className="grid gap-2.5">
        <Skeleton className="h-5 w-48" />
        <Skeleton className="h-10 w-2/3 sm:h-12" />
        <Skeleton className="h-5 w-full max-w-2xl" />
      </div>
      <div className="grid gap-10 lg:grid-cols-12">
        <ul className="grid content-start gap-5 lg:col-span-8 xl:col-span-9">
          {[0, 1].map((index) => (
            <li className="flex gap-2.5" key={index}>
              <Skeleton className="size-18 shrink-0 rounded-none" />
              <div className="grid flex-1 content-start gap-1 pt-0.5">
                <Skeleton className="h-5 w-2/3" />
                <Skeleton className="h-4 w-1/3" />
                <Skeleton className="h-4 w-1/4" />
              </div>
              <Skeleton className="h-5 w-16" />
            </li>
          ))}
        </ul>
        <div className="grid content-start gap-2.5 lg:col-span-4 xl:col-span-3">
          <Skeleton className="h-5" />
          <Skeleton className="h-5" />
          <Skeleton className="h-7" />
        </div>
      </div>
    </div>
  );
}
