"use client";

import { useAuthActions } from "@convex-dev/auth/react";
import { api } from "@jolene/backend/convex/_generated/api";
import { productKindLabels } from "@jolene/design";
import { Badge } from "@jolene/ui/badge";
import { Button } from "@jolene/ui/button";
import { Skeleton } from "@jolene/ui/skeleton";
import { toast } from "@jolene/ui/toaster";
import { useAction, useConvexAuth, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import {
  CircleAlert,
  ExternalLink,
  LoaderCircle,
  RefreshCw,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useCurrentLocale, useI18n } from "@/locales/client";

type Read = FunctionReturnType<typeof api.workshop.orders>;
type Order = Extract<Read, { status: "read" }>["orders"][number];
type Issue = Order["issues"][number];
type Translate = ReturnType<typeof useI18n>;

/**
 * The workshop's order list, for the Google accounts on its list: anyone
 * else is asked to sign in with one, or told theirs isn't on it.
 */
export function Workshop() {
  const t = useI18n();
  const { isLoading } = useConvexAuth();
  const access = useQuery(api.workshop.access, isLoading ? "skip" : {});
  if (access === undefined) return <OrdersSkeleton />;
  if (!access.signedIn)
    return access.googleConfigured ? (
      <SignIn signInAt={access.signInAt} />
    ) : (
      <Notice>{t("workshop.googleNotConfigured")}</Notice>
    );
  if (!access.allowed) return <NotAllowed email={access.email} />;
  return <Orders />;
}

function SignIn({ signInAt }: { signInAt: string | null }) {
  const t = useI18n();
  const { signIn } = useAuthActions();
  const [opening, setOpening] = useState(false);
  // Google's answer comes back to the deployment's SITE_URL, where alone the
  // sign-in can complete: from another address, such as the shop's, the
  // page links there.
  const there = signInAt ? new URL(signInAt) : null;
  if (there && there.origin !== window.location.origin)
    return (
      <div className="flex max-w-xl flex-col items-start gap-4 rounded-3xl border border-dashed p-10">
        <p>{t("workshop.signInThere")}</p>
        <Button asChild>
          <a href={there.href}>{t("workshop.goThere", { host: there.host })}</a>
        </Button>
      </div>
    );
  return (
    <div className="flex max-w-xl flex-col items-start gap-4 rounded-3xl border border-dashed p-10">
      <p>{t("workshop.signInLead")}</p>
      <Button
        disabled={opening}
        onClick={() => {
          setOpening(true);
          // Google sends the browser back here, where the sign-in completes.
          signIn("google", { redirectTo: "/atelier" }).catch(() => {
            setOpening(false);
            toast.error(t("common.error"));
          });
        }}
      >
        {opening ? <LoaderCircle className="animate-spin" aria-hidden /> : null}
        {opening ? t("workshop.signingIn") : t("workshop.signIn")}
      </Button>
      <p className="text-sm text-muted-foreground">
        {t("workshop.signInNote")}
      </p>
    </div>
  );
}

function NotAllowed({ email }: { email: string }) {
  const t = useI18n();
  const { signOut } = useAuthActions();
  return (
    <div className="flex max-w-xl flex-col items-start gap-4 rounded-3xl border border-dashed p-10">
      <p>{t("workshop.notAllowed", { email })}</p>
      <Button variant="outline" onClick={() => void signOut()}>
        {t("workshop.signOut")}
      </Button>
    </div>
  );
}

/** The open orders, read from Shopify when the page opens and on refresh. */
function Orders() {
  const t = useI18n();
  const locale = useCurrentLocale();
  const readOrders = useAction(api.workshop.orders);
  const [read, setRead] = useState<Read | "error">();
  const [reading, setReading] = useState(true);

  const refresh = useCallback(() => {
    setReading(true);
    readOrders({})
      .then(setRead)
      .catch(() => setRead("error"))
      .finally(() => setReading(false));
  }, [readOrders]);
  useEffect(refresh, [refresh]);

  const time = new Intl.DateTimeFormat(locale === "ro" ? "ro-RO" : "en-GB", {
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-center gap-4">
        <Button variant="outline" disabled={reading} onClick={refresh}>
          <RefreshCw className={reading ? "animate-spin" : undefined} />
          {t("workshop.refresh")}
        </Button>
        <p className="text-sm text-muted-foreground" aria-live="polite">
          {reading
            ? t("workshop.reading")
            : read && read !== "error" && read.status === "read"
              ? t("workshop.readAt", { time: time.format(read.readAt) })
              : null}
        </p>
      </div>
      {read === undefined ? (
        <OrdersSkeleton />
      ) : read === "error" ? (
        <Notice>{t("common.error")}</Notice>
      ) : read.status === "not-connected" ? (
        <Notice>{t("workshop.notConnected")}</Notice>
      ) : read.status === "failed" ? (
        <Notice>{t("workshop.failed", { message: read.message })}</Notice>
      ) : (
        <>
          {read.orders.length === 0 ? (
            <p className="rounded-3xl border border-dashed p-10 text-muted-foreground">
              {t("workshop.empty")}
            </p>
          ) : (
            <ol className="flex flex-col gap-6">
              {read.orders.map((order) => (
                <li key={order.id}>
                  <OrderCard order={order} />
                </li>
              ))}
            </ol>
          )}
          {read.more ? (
            <p className="text-sm text-muted-foreground">
              {t("workshop.more")}{" "}
              <a
                href={read.admin}
                target="_blank"
                rel="noreferrer"
                className="text-foreground underline underline-offset-4"
              >
                {t("workshop.allInShopify")}
              </a>
            </p>
          ) : null}
        </>
      )}
    </div>
  );
}

function OrderCard({ order }: { order: Order }) {
  const t = useI18n();
  const locale = useCurrentLocale();
  const tag = locale === "ro" ? "ro-RO" : "en-GB";
  const when = new Intl.DateTimeFormat(tag, {
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  });
  const day = new Intl.DateTimeFormat(tag, { day: "numeric", month: "long" });
  const number = new Intl.NumberFormat(tag, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  const money = (amount: string) =>
    `${number.format(Number(amount))} ${order.currency === "RON" ? "lei" : order.currency}`;
  const describe = (issue: Issue) => describeIssue(issue, t, money);

  return (
    <article className="rounded-3xl border bg-card p-6 sm:p-8">
      <header className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <h2 className="font-display text-3xl">{order.name}</h2>
        <time
          className="text-sm text-muted-foreground"
          dateTime={order.processedAt}
        >
          {when.format(new Date(order.processedAt))}
        </time>
        <div className="flex flex-wrap gap-2">
          <Badge variant={order.payment === "PAID" ? "default" : "gold"}>
            {paymentLabel(order.payment, t)}
          </Badge>
          {order.fulfillment !== "UNFULFILLED" ? (
            <Badge variant="outline">
              {fulfillmentLabel(order.fulfillment, t)}
            </Badge>
          ) : null}
          {order.test ? (
            <Badge variant="outline">{t("workshop.test")}</Badge>
          ) : null}
        </div>
        <a
          href={order.url}
          target="_blank"
          rel="noreferrer"
          className="ml-auto inline-flex items-center gap-1.5 text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
        >
          {t("workshop.openInShopify")}
          <ExternalLink className="size-3.5" aria-hidden />
        </a>
      </header>

      <Issues issues={order.issues} describe={describe} />

      <ul className="mt-6 flex flex-col divide-y">
        {order.lines.map((line) => (
          <li
            key={line.id}
            className="flex flex-col gap-5 py-5 first:pt-0 last:pb-0 sm:flex-row"
          >
            {line.proof ? (
              <figure className="w-full shrink-0 sm:w-44">
                {line.proof.image ? (
                  <a href={line.proof.image} target="_blank" rel="noreferrer">
                    <img
                      src={line.proof.image}
                      loading="lazy"
                      alt={`${productKindLabels[line.proof.kind][locale]}${line.proof.suite ? ` · ${line.proof.suite[locale]}` : ""}`}
                      className="aspect-[4/5] w-full rounded-2xl bg-secondary/70 object-contain"
                    />
                  </a>
                ) : (
                  <div className="flex aspect-[4/5] w-full items-center justify-center rounded-2xl bg-secondary/70 text-sm text-muted-foreground">
                    {t("workshop.noPicture")}
                  </div>
                )}
                <figcaption className="mt-2 text-xs text-muted-foreground">
                  {t("workshop.proof", {
                    date: day.format(line.proof.approvedAt),
                  })}
                </figcaption>
              </figure>
            ) : null}
            <div className="flex min-w-0 flex-1 flex-col gap-3">
              <div>
                <h3 className="text-lg font-medium">{line.title}</h3>
                <p className="text-sm text-muted-foreground">
                  {[
                    line.variant,
                    t("workshop.quantity", { count: line.quantity }),
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              </div>
              {line.answers.length > 0 ? (
                <dl className="grid gap-x-6 gap-y-1 text-sm sm:grid-cols-[max-content_1fr]">
                  {line.answers.map((answer) => (
                    <div key={answer.label} className="contents">
                      <dt className="text-muted-foreground">{answer.label}</dt>
                      <dd className="whitespace-pre-line break-words">
                        {answer.value}
                      </dd>
                    </div>
                  ))}
                </dl>
              ) : null}
              {line.extras ? (
                <p className="text-sm">
                  {t("workshop.extras", { amount: money(line.extras) })}
                </p>
              ) : null}
              <Issues issues={line.issues} describe={describe} />
            </div>
          </li>
        ))}
      </ul>

      {order.fees.length > 0 || order.note ? (
        <footer className="mt-6 flex flex-col gap-2 border-t pt-5 text-sm">
          {order.fees.length > 0 ? (
            <p>
              {t("workshop.fees", {
                fees: order.fees
                  .map((fee) =>
                    fee.quantity > 1
                      ? `${fee.title} × ${fee.quantity}`
                      : fee.title,
                  )
                  .join(", "),
              })}
            </p>
          ) : null}
          {order.note ? (
            <p className="whitespace-pre-line">
              {t("workshop.note", { note: order.note })}
            </p>
          ) : null}
        </footer>
      ) : null}
    </article>
  );
}

function Issues({
  issues,
  describe,
}: {
  issues: Issue[];
  describe: (issue: Issue) => string;
}) {
  const t = useI18n();
  if (issues.length === 0) return null;
  return (
    <div className="mt-4 rounded-2xl bg-gold/10 p-4 text-sm">
      <p className="flex items-center gap-2 font-medium">
        <CircleAlert className="size-4 text-gold" aria-hidden />
        {t("workshop.toCheck")}
      </p>
      <ul className="mt-2 flex list-disc flex-col gap-1 pl-6">
        {issues.map((issue) => (
          <li key={JSON.stringify(issue)}>{describe(issue)}</li>
        ))}
      </ul>
    </div>
  );
}

function Notice({ children }: { children: string }) {
  return (
    <p className="flex max-w-2xl items-start gap-2 rounded-3xl border border-dashed p-8">
      <CircleAlert className="mt-0.5 size-4 shrink-0 text-gold" aria-hidden />
      {children}
    </p>
  );
}

function describeIssue(
  issue: Issue,
  t: Translate,
  money: (amount: string) => string,
) {
  switch (issue.kind) {
    case "not-paid":
      return t("workshop.issues.notPaid", {
        status: paymentLabel(issue.status, t),
      });
    case "below-minimum":
      return t("workshop.issues.belowMinimum", { count: issue.minQuantity });
    case "missing-answer":
      return t("workshop.issues.missingAnswer", { option: issue.option });
    case "unknown-choice":
      return t("workshop.issues.unknownChoice", {
        answer: issue.answer,
        option: issue.option,
      });
    case "extras":
      return t("workshop.issues.extras", {
        paid: money(issue.paid),
        expected: money(issue.expected),
      });
    case "extras-alone":
      return t("workshop.issues.extrasAlone", { paid: money(issue.paid) });
    case "fee-missing":
      return t("workshop.issues.feeMissing", { fee: issue.fee });
    case "product-gone":
      return t("workshop.issues.productGone");
    case "proof-missing":
      return t("workshop.issues.proofMissing", { proof: issue.proof });
  }
}

/** Shopify's financial status in the visitor's words. */
function paymentLabel(status: string | null, t: Translate) {
  switch (status) {
    case "PAID":
      return t("workshop.payment.paid");
    case "PARTIALLY_REFUNDED":
      return t("workshop.payment.partiallyRefunded");
    case "PENDING":
      return t("workshop.payment.pending");
    case "AUTHORIZED":
      return t("workshop.payment.authorized");
    case "PARTIALLY_PAID":
      return t("workshop.payment.partiallyPaid");
    case "REFUNDED":
      return t("workshop.payment.refunded");
    case "VOIDED":
      return t("workshop.payment.voided");
    case "EXPIRED":
      return t("workshop.payment.expired");
    default:
      return status ?? t("workshop.payment.none");
  }
}

/** Shopify's fulfillment status in the visitor's words. */
function fulfillmentLabel(status: string, t: Translate) {
  switch (status) {
    case "UNFULFILLED":
      return t("workshop.fulfillment.unfulfilled");
    case "PARTIALLY_FULFILLED":
      return t("workshop.fulfillment.partiallyFulfilled");
    case "IN_PROGRESS":
      return t("workshop.fulfillment.inProgress");
    case "ON_HOLD":
      return t("workshop.fulfillment.onHold");
    case "SCHEDULED":
      return t("workshop.fulfillment.scheduled");
    case "PENDING_FULFILLMENT":
      return t("workshop.fulfillment.pendingFulfillment");
    case "OPEN":
      return t("workshop.fulfillment.open");
    case "FULFILLED":
      return t("workshop.fulfillment.fulfilled");
    case "RESTOCKED":
      return t("workshop.fulfillment.restocked");
    case "REQUEST_DECLINED":
      return t("workshop.fulfillment.requestDeclined");
    default:
      return status;
  }
}

export function OrdersSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      {[0, 1].map((key) => (
        <Skeleton key={key} className="h-64 rounded-3xl" />
      ))}
    </div>
  );
}
