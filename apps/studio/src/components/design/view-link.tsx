"use client";

import { api } from "@jolene/backend/convex/_generated/api";
import type { Id } from "@jolene/backend/convex/_generated/dataModel";
import type { DesignDocument, Fields } from "@jolene/design";
import { Button } from "@jolene/ui/button";
import { Input } from "@jolene/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@jolene/ui/popover";
import { toast } from "@jolene/ui/toaster";
import { useAction, useMutation } from "convex/react";
import {
  Copy,
  ExternalLink,
  LoaderCircle,
  MessageCircle,
  Share2,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { whatsappLink } from "@/lib/invite-links";
import { useI18n } from "@/locales/client";
import type { AssetLink } from "./design-preview";
import { canvasBlob, renderCanvas } from "./render-image";

/** The long side of the picture kept for the link's preview, in pixels. */
const PICTURE_LONG_SIDE = 1200;

/** A design's viewing link, on the studio's own address (docs/adr/0023). */
export function viewLink(origin: string, code: string) {
  return `${origin}/studio/vizionare/${code}`;
}

/**
 * The button that shows a design to parents and friends: it turns the
 * design's viewing link on, offers it to copy or send on WhatsApp, and
 * turns it off. While the link is on, the browser draws the design for the
 * link's preview, again whenever the design has changed since.
 */
export function ViewLink({
  designId,
  revision,
  code,
  pictured,
  document,
  fields,
  assets,
}: {
  designId: Id<"designs">;
  revision: number;
  /** The link's code, while the link is on. */
  code: string | undefined;
  /** The revision the link's picture shows, once there is one. */
  pictured: number | undefined;
  document: DesignDocument;
  fields: Fields;
  assets: readonly AssetLink[];
}) {
  const t = useI18n();
  const setViewLink = useMutation(api.designs.setViewLink);
  const attachImage = useAction(api.designs.attachViewImage);
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [origin, setOrigin] = useState<string | null>(null);
  useEffect(() => setOrigin(window.location.origin), []);
  const link = code && origin ? viewLink(origin, code) : null;

  // The picture, drawn once a revision while the menu is open.
  const drawn = useRef<string | null>(null);
  const stale = Boolean(code) && pictured !== revision;
  useEffect(() => {
    if (!open || !code || !stale) return;
    const key = `${code}:${revision}`;
    if (drawn.current === key) return;
    drawn.current = key;
    void (async () => {
      const canvas = await renderCanvas({
        design: document,
        fields,
        assets,
        view: { kind: "assembly" },
        longSide: PICTURE_LONG_SIDE,
      });
      const image = await canvasBlob(canvas, "image/jpeg", 0.85);
      await attachImage({
        designId,
        revision,
        image: await image.arrayBuffer(),
      });
    })().catch(() => {
      // A picture that couldn't be drawn is tried again next time.
      drawn.current = null;
    });
  }, [
    open,
    code,
    stale,
    revision,
    document,
    fields,
    assets,
    attachImage,
    designId,
  ]);

  const turn = async (on: boolean) => {
    setPending(true);
    try {
      await setViewLink({ designId, on });
    } catch {
      toast.error(t("design.view.failed"));
    } finally {
      setPending(false);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5 px-2.5">
          <Share2 aria-hidden />
          <span className="hidden sm:inline">{t("design.view.show")}</span>
          <span className="sr-only sm:hidden">{t("design.view.show")}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-4">
        <h2 className="font-display text-lg">{t("design.view.title")}</h2>
        <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">
          {t("design.view.lead")}
        </p>
        {code ? (
          <div className="mt-4 flex flex-col gap-2">
            <Input
              readOnly
              value={link ?? ""}
              aria-label={t("design.view.title")}
              onFocus={(event) => event.currentTarget.select()}
              className="h-9 text-[13px]"
            />
            <div className="grid grid-cols-2 gap-2">
              <Button
                variant="secondary"
                size="sm"
                disabled={!link}
                onClick={() => {
                  if (!link) return;
                  void navigator.clipboard
                    .writeText(link)
                    .then(() => toast(t("design.view.copied")));
                }}
              >
                <Copy aria-hidden />
                {t("design.view.copy")}
              </Button>
              <Button asChild variant="secondary" size="sm">
                <a
                  href={
                    link
                      ? whatsappLink(t("design.view.message", { link }))
                      : "#"
                  }
                  target="_blank"
                  rel="noopener"
                  aria-disabled={!link}
                >
                  <MessageCircle aria-hidden />
                  {t("design.view.whatsapp")}
                </a>
              </Button>
            </div>
            <div className="mt-1 flex items-center justify-between gap-2">
              <Button asChild variant="link" size="sm" className="px-0">
                <a href={link ?? "#"} target="_blank" rel="noopener">
                  <ExternalLink aria-hidden />
                  {t("design.view.open")}
                </a>
              </Button>
              <Button
                variant="ghost"
                size="sm"
                disabled={pending}
                onClick={() => void turn(false)}
              >
                {pending ? (
                  <LoaderCircle className="animate-spin" aria-hidden />
                ) : null}
                {t("design.view.off")}
              </Button>
            </div>
          </div>
        ) : (
          <Button
            className="mt-4 w-full"
            disabled={pending}
            onClick={() => void turn(true)}
          >
            {pending ? (
              <LoaderCircle className="animate-spin" aria-hidden />
            ) : (
              <Share2 aria-hidden />
            )}
            {pending ? t("design.view.starting") : t("design.view.on")}
          </Button>
        )}
      </PopoverContent>
    </Popover>
  );
}
