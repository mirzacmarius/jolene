"use client";

import { api } from "@jolene/backend/convex/_generated/api";
import type { Id } from "@jolene/backend/convex/_generated/dataModel";
import { type DesignDocument, previewFields } from "@jolene/design";
import { digitalInvitation } from "@jolene/products/digital-invitation";
import { Badge } from "@jolene/ui/badge";
import { Button } from "@jolene/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@jolene/ui/dropdown-menu";
import { Skeleton } from "@jolene/ui/skeleton";
import { toast } from "@jolene/ui/toaster";
import { useAction, useMutation, useQuery } from "convex/react";
import { CircleCheck, ExternalLink, LoaderCircle } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { DesignPreview } from "@/components/design/design-preview";
import { canvasBlob, renderCanvas } from "@/components/design/render-image";
import { householdLink, inviteLink } from "@/lib/invite-links";
import { JOLENE_EMAIL, useShopSells } from "@/lib/shop";
import { useCurrentLocale, useI18n } from "@/locales/client";
import type { Dashboard, Invite, Previews } from "./types";

/**
 * The longest side of the picture of the card that link previews and the
 * invitation's emails show: sharp in a chat, light enough for WhatsApp.
 */
const PICTURE_LONG_SIDE = 1080;

/**
 * Draws the published design and keeps it with the invitation, once for
 * each version published: WhatsApp's link preview and the emails show it.
 * The family's name is left out, since the picture is everyone's.
 */
function usePublishedPicture(
  invite: Invite,
  previews: Previews | null | undefined,
) {
  const attach = useAction(api.invites.attachImage);
  const drawn = useRef<string | null>(null);
  const published = previews?.published;
  const missing =
    invite.published !== null &&
    invite.published.image === null &&
    published?.designId === invite.published.designId &&
    published.revision === invite.published.revision;
  useEffect(() => {
    if (!missing || !published || !previews) return;
    const key = `${published.designId}:${published.revision}`;
    // One try a version on this page; a later visit tries again.
    if (drawn.current === key) return;
    drawn.current = key;
    void (async () => {
      const canvas = await renderCanvas({
        design: published.document as DesignDocument,
        fields: previews.fields,
        assets: previews.assets,
        view: { kind: "assembly" },
        longSide: PICTURE_LONG_SIDE,
      });
      const image = await canvasBlob(canvas, "image/jpeg", 0.85);
      await attach({
        inviteId: invite._id,
        designId: published.designId,
        revision: published.revision,
        image: await image.arrayBuffer(),
      });
    })().catch(() => {});
  }, [missing, published, previews, attach, invite._id]);
}

/**
 * The card guests open: the version they see, a way to publish the
 * couple's changes or another design, a look at it as a guest, and whether
 * it's open to every guest or still on trial.
 */
export function InvitationPanel({
  data,
  invite,
}: {
  data: Dashboard;
  invite: Invite;
}) {
  const t = useI18n();
  const locale = useCurrentLocale();
  const previews = useQuery(api.invites.previews, { eventId: data.event._id });
  const publish = useMutation(api.invites.publish);
  const [publishing, setPublishing] = useState(false);
  usePublishedPicture(invite, previews);

  const published = invite.published;
  const current = data.designs.find(
    (design) => design._id === published?.designId,
  );
  const changed = Boolean(
    current && published && current.revision > published.revision,
  );
  const others = data.designs.filter(
    (design) => design._id !== published?.designId,
  );
  const formatted = (time: number, withTime = true) =>
    new Intl.DateTimeFormat(locale === "ro" ? "ro-RO" : "en-GB", {
      day: "numeric",
      month: "long",
      ...(withTime ? { hour: "2-digit", minute: "2-digit" } : {}),
    }).format(time);

  const onPublish = async (designId: Id<"designs">) => {
    setPublishing(true);
    try {
      await publish({ inviteId: invite._id, designId });
    } catch {
      toast.error(t("common.error"));
    } finally {
      setPublishing(false);
    }
  };

  // How the couple sees it as a guest would: the open link once it opens to
  // everyone, else the first family's own link.
  const first = data.households[0];
  const guestView = !data.base
    ? null
    : invite.unlocked && invite.open
      ? inviteLink(data.base, invite.slug)
      : first
        ? householdLink(data.base, invite.slug, first.code)
        : null;

  const shown = previews?.published;
  const document = shown?.document as DesignDocument | undefined;

  return (
    <section className="flex flex-col gap-5 rounded-3xl border border-border/80 bg-card p-5 sm:p-6">
      <h2 className="font-display text-2xl">{t("invite.design")}</h2>
      <div className="relative aspect-[4/5] rounded-2xl bg-secondary/70">
        {previews === undefined ? (
          <Skeleton className="absolute inset-0 rounded-2xl" />
        ) : document && previews ? (
          <div className="absolute inset-5">
            <DesignPreview
              document={document}
              fields={{
                ...previewFields(document.occasion, document.language, {}),
                ...previews.fields,
              }}
              assets={previews.assets}
              title={data.hosts[locale]}
              className="size-full"
            />
          </div>
        ) : null}
      </div>
      {published ? (
        <p className="text-sm text-muted-foreground">
          {t("invite.published", { date: formatted(published.at) })}
        </p>
      ) : null}
      {changed && current ? (
        <div className="flex flex-col items-start gap-3 rounded-2xl bg-gold/10 p-4">
          <p className="text-sm">{t("invite.changed")}</p>
          <Button
            size="sm"
            disabled={publishing}
            onClick={() => void onPublish(current._id)}
          >
            {publishing ? (
              <LoaderCircle className="animate-spin" aria-hidden />
            ) : null}
            {publishing ? t("invite.publishing") : t("invite.publish")}
          </Button>
        </div>
      ) : null}
      <div className="flex flex-wrap gap-2">
        {guestView ? (
          <Button asChild size="sm">
            <a href={guestView} target="_blank" rel="noopener">
              <ExternalLink aria-hidden />
              {t("invite.preview")}
            </a>
          </Button>
        ) : null}
        {data.role === "owner" && published ? (
          <Button asChild size="sm" variant="outline">
            <Link href={`/studio/design/${published.designId}`}>
              {t("invite.editDesign")}
            </Link>
          </Button>
        ) : null}
        {others.length > 0 ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" variant="ghost" disabled={publishing}>
                {t("invite.choose")}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              {others.map((design) => (
                <DropdownMenuItem
                  key={design._id}
                  onSelect={() => void onPublish(design._id)}
                >
                  {design.suite ? `${design.suite[locale]} · ` : null}
                  {t("invite.edited", {
                    date: formatted(design.updatedAt, false),
                  })}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}
      </div>
      {guestView ? null : data.base ? (
        <p className="text-sm text-muted-foreground">
          {t("invite.previewHint")}
        </p>
      ) : null}

      <div className="border-t border-border/70 pt-5">
        {invite.unlocked ? (
          <p className="flex items-start gap-2 text-sm">
            <CircleCheck
              className="mt-0.5 size-4 shrink-0 text-primary"
              aria-hidden
            />
            <span>
              <span className="font-medium">{t("invite.unlocked")}</span>
              <br />
              <span className="text-muted-foreground">
                {invite.unlocked.by === "print"
                  ? t("invite.unlockedPrint", { order: invite.unlocked.order })
                  : t("invite.unlockedOrder", { order: invite.unlocked.order })}
              </span>
            </span>
          </p>
        ) : (
          <div className="flex flex-col items-start gap-3">
            <Badge variant="gold">{t("invite.trial")}</Badge>
            <p className="text-sm">
              {t("invite.trialLead", { count: data.trial })}
            </p>
            <p className="text-sm text-muted-foreground">
              {t("invite.unlockLead", {
                price: `${digitalInvitation.price} lei`,
              })}
            </p>
            <Unlock eventId={data.event._id} />
          </div>
        )}
      </div>
    </section>
  );
}

/**
 * Opens the invitation to every guest: the shop, on this same address
 * (microfrontends.json), sells it for the event. Until the shop sells it
 * online, the couple writes to Jolene.
 */
function Unlock({ eventId }: { eventId: Id<"events"> }) {
  const t = useI18n();
  const sells = useShopSells(digitalInvitation.handle);
  if (sells === undefined)
    return <Button disabled>{t("invite.unlock")}</Button>;
  if (!sells)
    return (
      <>
        <p className="text-sm text-muted-foreground">{t("invite.notOnline")}</p>
        <Button asChild variant="outline">
          <a
            href={`mailto:${JOLENE_EMAIL}?subject=${encodeURIComponent(
              t("invite.unlockMail", { code: eventId }),
            )}`}
          >
            {t("invite.writeToUs")}
          </a>
        </Button>
      </>
    );
  return (
    <Button asChild>
      <a href={`/products/${digitalInvitation.handle}?event=${eventId}`}>
        {t("invite.unlock")}
      </a>
    </Button>
  );
}
