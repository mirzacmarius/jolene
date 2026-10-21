"use client";

import { api } from "@jolene/backend/convex/_generated/api";
import type { Parcel } from "@jolene/backend/convex/orders/validators";
import {
  STANDARD_PARCEL,
  validParcel,
} from "@jolene/backend/convex/shipments/booking";
import { Button } from "@jolene/ui/button";
import { Input } from "@jolene/ui/input";
import { Label } from "@jolene/ui/label";
import { SegmentedControl } from "@jolene/ui/segmented-control";
import { Skeleton } from "@jolene/ui/skeleton";
import { toast } from "@jolene/ui/toaster";
import { useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { ExternalLink, LoaderCircle } from "lucide-react";
import { type FormEvent, useId, useState } from "react";
import { errorCode } from "@/lib/convex-error";
import { useCurrentLocale, useI18n } from "@/locales/client";
import { useFormats } from "./formats";
import { useStuck } from "./stuck";

type Order = NonNullable<FunctionReturnType<typeof api.workshop.order>>;
type Shipment = NonNullable<
  FunctionReturnType<typeof api.shipments.forWorkshop>
>;
type Translate = ReturnType<typeof useI18n>;

/** The longest courier's name or AWB the team can type (workshop.recordAwb). */
const TYPED_LENGTH = 100;

/** What the team measures of a parcel, in the order Colete Online asks. */
const MEASURES = ["weight", "length", "width", "height"] as const;
type Measures = Record<keyof Parcel, string>;

/** A measure as someone types it, such as 1,5 or 35: null for anything else. */
function parseMeasure(text: string): number | null {
  const match = /^\s*(\d{1,4})(?:[.,](\d{1,2}))?\s*$/.exec(text);
  return match?.[1] ? Number(`${match[1]}.${match[2] ?? 0}`) : null;
}

/** The parcel the team measured, or null until couriers would take it. */
function parcelOf(measures: Measures): Parcel | null {
  const weight = parseMeasure(measures.weight);
  const length = parseMeasure(measures.length);
  const width = parseMeasure(measures.width);
  const height = parseMeasure(measures.height);
  if (weight === null || length === null || width === null || height === null)
    return null;
  const parcel = { weight, length, width, height };
  return validParcel(parcel) ? parcel : null;
}

/** Why booking the courier or saving its AWB didn't happen, for a toast. */
function failure(t: Translate, error: unknown): string {
  switch (errorCode(error)) {
    case "order-moved":
      return t("workshop.moved");
    case "shipment-booked":
      return t("workshop.courier.bookedAlready");
    case "courier-unavailable":
      return t("workshop.courier.unavailable");
    case "invalid-input":
      return t("workshop.courier.invalid");
    default:
      return t("common.error");
  }
}

/**
 * The courier taking an order's parcel to the couple's door: Colete Online
 * books the cheapest one for the box the team packed and gives its label to
 * print, or the team books one itself and types its AWB. Either moves the
 * order on to sent and emails the couple the AWB.
 */
export function CourierPanel({
  order,
  number,
}: {
  order: Order;
  number: number;
}) {
  const t = useI18n();
  const id = useId();
  const shipment = useQuery(api.shipments.forWorkshop, { number });
  const stuck = useStuck(
    shipment?.status === "booking" ? shipment.at : undefined,
  );
  const [typing, setTyping] = useState(false);
  if (shipment === undefined) return <Skeleton className="h-36 rounded-3xl" />;
  // A done or cancelled order only shows the courier it had, if any.
  const sending =
    order.status === "paid" ||
    order.status === "making" ||
    order.status === "sent";
  if (!shipment && !sending) return null;
  const bookable =
    sending && (!shipment || shipment.status === "failed" || stuck);
  // A courier the team booked itself can be corrected by its AWB.
  const correctable =
    shipment?.status === "booked" &&
    !shipment.id &&
    order.status !== "cancelled";
  // Without Colete Online's keys, typing the AWB is the only way to send it.
  const typeForm = typing
    ? bookable || correctable
    : bookable && !order.courierBooking;
  return (
    <section
      aria-labelledby={`${id}-title`}
      className="flex flex-col gap-4 rounded-3xl border bg-card p-5"
    >
      <h2 id={`${id}-title`} className="font-medium">
        {t("workshop.courier.title")}
      </h2>
      {shipment === null ? (
        <p className="max-w-prose text-sm text-muted-foreground">
          {order.courierBooking
            ? t("workshop.courier.lead")
            : t("workshop.courier.unavailable")}
        </p>
      ) : shipment.status === "booked" ? (
        <Booked
          shipment={shipment}
          number={number}
          refreshable={order.courierBooking && Boolean(shipment.id)}
          onCorrect={correctable && !typing ? () => setTyping(true) : undefined}
        />
      ) : stuck ? (
        <p className="max-w-prose text-sm text-destructive">
          {t("workshop.courier.stuck")}
        </p>
      ) : shipment.status === "booking" ? (
        <p className="flex items-center gap-2 text-sm">
          <LoaderCircle className="size-4 animate-spin" aria-hidden />
          {t("workshop.courier.booking")}
        </p>
      ) : (
        <div className="text-sm">
          <p className="text-destructive">{t("workshop.courier.failed")}</p>
          {shipment.error ? (
            <p className="mt-1 break-words text-muted-foreground">
              {shipment.error}
            </p>
          ) : null}
        </div>
      )}
      {typeForm ? (
        <AwbForm
          order={order}
          number={number}
          shipment={shipment}
          onClose={typing ? () => setTyping(false) : undefined}
        />
      ) : bookable ? (
        <BookForm
          order={order}
          number={number}
          again={shipment !== null}
          onType={() => setTyping(true)}
        />
      ) : null}
    </section>
  );
}

/** Colete Online's YYYY-MM-DD as the workshop writes days, or as it came. */
function pickupDay(date: string, day: (at: number) => string) {
  const at = new Date(`${date}T12:00:00`).getTime();
  return Number.isNaN(at) ? date : day(at);
}

/**
 * The courier that's taking the parcel and its AWB, with what Colete Online
 * said of the booking, the label to print and where the parcel is.
 */
function Booked({
  shipment,
  number,
  refreshable,
  onCorrect,
}: {
  shipment: Shipment;
  number: number;
  /** Colete Online booked it, and can be asked where it is. */
  refreshable: boolean;
  onCorrect?: () => void;
}) {
  const t = useI18n();
  const format = useFormats();
  const refresh = useMutation(api.shipments.refresh);
  const [asking, setAsking] = useState(false);
  const awb = shipment.awb ?? "";
  const facts = [
    shipment.service &&
      t("workshop.courier.service", { service: shipment.service }),
    shipment.price !== undefined &&
      t("workshop.courier.price", { price: format.lei(shipment.price) }),
    shipment.pickupDate &&
      t("workshop.courier.pickupDate", {
        date: pickupDay(shipment.pickupDate, format.day),
      }),
  ].filter(Boolean);
  const ask = async () => {
    setAsking(true);
    try {
      if (await refresh({ number })) toast(t("workshop.courier.asked"));
      else toast.error(t("common.error"));
    } catch {
      toast.error(t("common.error"));
    } finally {
      setAsking(false);
    }
  };
  return (
    <div className="flex flex-col gap-3 text-sm">
      <div>
        <p className="text-base">
          {shipment.courier
            ? t("workshop.courier.booked", { courier: shipment.courier, awb })
            : t("workshop.courier.awbOnly", { awb })}
        </p>
        {facts.length > 0 ? (
          <p className="text-muted-foreground">{facts.join(" · ")}</p>
        ) : null}
      </div>
      <p className={shipment.id ? undefined : "text-muted-foreground"}>
        {!shipment.id
          ? t("workshop.courier.typed")
          : shipment.tracking
            ? t("workshop.courier.tracking", {
                text: shipment.tracking.text,
                time: format.time(shipment.tracking.at),
              })
            : t("workshop.courier.noTracking")}
      </p>
      {shipment.warning ? (
        <p className="break-words text-destructive">{shipment.warning}</p>
      ) : null}
      {shipment.label || refreshable || onCorrect ? (
        <div className="flex flex-wrap gap-2">
          {shipment.label ? (
            <Button asChild size="sm">
              <a href={shipment.label} target="_blank" rel="noreferrer">
                {t("workshop.courier.label")}
                <ExternalLink aria-hidden />
              </a>
            </Button>
          ) : null}
          {refreshable ? (
            <Button
              size="sm"
              variant="outline"
              disabled={asking}
              onClick={() => void ask()}
            >
              {t("workshop.courier.refresh")}
            </Button>
          ) : null}
          {onCorrect ? (
            <Button size="sm" variant="outline" onClick={onCorrect}>
              {t("workshop.courier.correctAwb")}
            </Button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

/** Books Colete Online's courier for the usual box, or one the team measured. */
function BookForm({
  order,
  number,
  again,
  onType,
}: {
  order: Order;
  number: number;
  /** A booking was refused or got stuck before. */
  again: boolean;
  onType: () => void;
}) {
  const t = useI18n();
  const locale = useCurrentLocale();
  const format = useFormats();
  const id = useId();
  const book = useMutation(api.workshop.bookCourier);
  const [box, setBox] = useState<"standard" | "other">("standard");
  const [measures, setMeasures] = useState<Measures>(() => {
    const typed = (value: number) =>
      locale === "ro" ? String(value).replace(".", ",") : String(value);
    return {
      weight: typed(STANDARD_PARCEL.weight),
      length: typed(STANDARD_PARCEL.length),
      width: typed(STANDARD_PARCEL.width),
      height: typed(STANDARD_PARCEL.height),
    };
  });
  const [busy, setBusy] = useState(false);
  const parcel = box === "standard" ? STANDARD_PARCEL : parcelOf(measures);
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!parcel) return;
    setBusy(true);
    try {
      await book({ number, from: order.status, parcel });
    } catch (error) {
      toast.error(failure(t, error));
    } finally {
      setBusy(false);
    }
  };
  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-3">
        <SegmentedControl
          label={t("workshop.courier.box")}
          value={box}
          onValueChange={setBox}
          options={[
            { value: "standard", label: t("workshop.courier.standard") },
            { value: "other", label: t("workshop.courier.other") },
          ]}
          className="self-start"
        />
        {box === "standard" ? (
          <p className="text-sm text-muted-foreground">
            {t("workshop.courier.size", {
              weight: format.number(STANDARD_PARCEL.weight),
              length: format.number(STANDARD_PARCEL.length),
              width: format.number(STANDARD_PARCEL.width),
              height: format.number(STANDARD_PARCEL.height),
            })}
          </p>
        ) : (
          <fieldset className="flex flex-col gap-2">
            <legend className="sr-only">{t("workshop.courier.box")}</legend>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {MEASURES.map((key) => (
                <div key={key} className="flex flex-col gap-2">
                  <Label htmlFor={`${id}-${key}`}>
                    {t(`workshop.courier.${key}`)}
                  </Label>
                  <Input
                    id={`${id}-${key}`}
                    inputMode="decimal"
                    autoComplete="off"
                    value={measures[key]}
                    onChange={(event) =>
                      setMeasures((current) => ({
                        ...current,
                        [key]: event.target.value,
                      }))
                    }
                    aria-invalid={parseMeasure(measures[key]) === null}
                    aria-describedby={`${id}-limits`}
                  />
                </div>
              ))}
            </div>
            <p
              id={`${id}-limits`}
              className={
                parcel
                  ? "text-xs text-muted-foreground"
                  : "text-xs text-destructive"
              }
            >
              {t("workshop.courier.limits")}
            </p>
          </fieldset>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <Button type="submit" size="sm" disabled={busy || !parcel}>
          {again ? t("workshop.courier.bookAgain") : t("workshop.courier.book")}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="link"
          className="px-0 text-muted-foreground hover:text-foreground"
          onClick={onType}
        >
          {t("workshop.courier.typeAwb")}
        </Button>
      </div>
    </form>
  );
}

/**
 * Saves the AWB of a courier the team booked itself, or corrects the one it
 * typed before; the couple get it by email.
 */
function AwbForm({
  order,
  number,
  shipment,
  onClose,
}: {
  order: Order;
  number: number;
  shipment: Shipment | null;
  /** None when typing is the only way, as without Colete Online's keys. */
  onClose?: () => void;
}) {
  const t = useI18n();
  const id = useId();
  const record = useMutation(api.workshop.recordAwb);
  const typed = shipment?.status === "booked" ? shipment : undefined;
  const [courier, setCourier] = useState(typed?.courier ?? "");
  const [awb, setAwb] = useState(typed?.awb ?? "");
  const [busy, setBusy] = useState(false);
  const valid = awb.replace(/\s/g, "") !== "";
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!valid) return;
    setBusy(true);
    try {
      await record({ number, from: order.status, courier, awb });
      toast.success(t("workshop.courier.saved"));
      onClose?.();
    } catch (error) {
      toast.error(failure(t, error));
    } finally {
      setBusy(false);
    }
  };
  return (
    <form
      onSubmit={submit}
      aria-label={t("workshop.courier.typeTitle")}
      className="flex flex-col gap-3"
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor={`${id}-courier`}>
            {t("workshop.courier.courier")}
          </Label>
          <Input
            id={`${id}-courier`}
            value={courier}
            maxLength={TYPED_LENGTH}
            autoComplete="off"
            placeholder={t("workshop.courier.courierPlaceholder")}
            onChange={(event) => setCourier(event.target.value)}
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor={`${id}-awb`}>{t("workshop.courier.awb")}</Label>
          <Input
            id={`${id}-awb`}
            value={awb}
            maxLength={TYPED_LENGTH}
            autoComplete="off"
            spellCheck={false}
            className="tabular-nums"
            onChange={(event) => setAwb(event.target.value)}
          />
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        {t("workshop.courier.emailed")}
      </p>
      <div className="flex flex-wrap gap-2">
        <Button type="submit" size="sm" disabled={busy || !valid}>
          {typed
            ? t("workshop.courier.correctAwb")
            : t("workshop.courier.saveAwb")}
        </Button>
        {onClose ? (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            disabled={busy}
            onClick={onClose}
          >
            {t("workshop.courier.keep")}
          </Button>
        ) : null}
      </div>
    </form>
  );
}
