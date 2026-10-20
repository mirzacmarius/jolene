"use client";

import { api } from "@jolene/backend/convex/_generated/api";
import type { Id } from "@jolene/backend/convex/_generated/dataModel";
import type { DesignDocument, Fields } from "@jolene/design";
import { Badge } from "@jolene/ui/badge";
import { Button } from "@jolene/ui/button";
import { Skeleton } from "@jolene/ui/skeleton";
import { toast } from "@jolene/ui/toaster";
import { cn } from "@jolene/ui/utils";
import { useMutation, useQuery } from "convex/react";
import { ConvexError } from "convex/values";
import { ChevronDown, ChevronUp, Sparkles, X } from "lucide-react";
import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { useCurrentLocale, useI18n } from "@/locales/client";
import type { AssetLink, PreviewView } from "../design/design-preview";
import { Composer } from "./composer";
import { Conversation, isWorking } from "./conversation";
import { useAnswerRendering, useUploadImage } from "./rendering";
import { useRetry } from "./retry";
import { takeSnapshot, viewName } from "./snapshot";

/**
 * The sheet's size: beside the design on large screens, under it on phones,
 * where it folds down to its header.
 */
const SHEET_WIDTH = "400px";
const SHEET_HEIGHT = "min(64dvh, 600px)";
const FOLDED_HEIGHT = "3.5rem";

/** Shown under the input once this few of the day's messages are left. */
const FEW_LEFT = 3;

/** The start of today in UTC, when the daily limits start again. */
export function startOfDay() {
  const now = new Date();
  return Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
}

/**
 * The AI designer: its button for the workspace's header and the sheet it
 * opens, on the right of the design on large screens and from the bottom on
 * phones. Mounted once, in the header; the sheet itself is portalled to the
 * page so it sits above everything else.
 */
export function AiDesigner({
  designId,
  revision,
  design,
  fields,
  assets,
  view,
  onOpenChange,
}: {
  designId: Id<"designs">;
  /** The design's revision, as the studio shows it. */
  revision: number;
  design: DesignDocument;
  /** The details as the preview shows them, examples in the empty ones. */
  fields: Fields;
  assets: readonly AssetLink[];
  /** What the studio shows, which a snapshot draws. */
  view: PreviewView;
  /** Told when the sheet opens or closes, for a layout that makes room. */
  onOpenChange?: (open: boolean) => void;
}) {
  const t = useI18n();
  const locale = useCurrentLocale();
  const sheetId = useId();
  const [open, setOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState<string>();
  const [restingToday, setRestingToday] = useState(false);
  const [since] = useState(startOfDay);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const availability = useQuery(api.ai.availability, { since });
  const messages = useQuery(
    api.ai.messages,
    open && availability?.configured ? { designId } : "skip",
  );
  const send = useMutation(api.ai.send);
  const stop = useMutation(api.ai.stop);
  const retry = useRetry();
  const undo = useMutation(api.ai.undo);
  const upload = useUploadImage();
  const answerRendering = useAnswerRendering();

  useEffect(() => setMounted(true), []);

  useEffect(() => onOpenChange?.(open), [open, onOpenChange]);

  // The workspace makes room for the sheet, so nothing stays under it: beside
  // the design on large screens (by --ai-sheet-width), and at the end of the
  // page on phones (by --ai-sheet-height).
  useLayoutEffect(() => {
    if (!open) return;
    const root = window.document.documentElement;
    root.style.setProperty("--ai-sheet-width", SHEET_WIDTH);
    root.style.setProperty(
      "--ai-sheet-height",
      collapsed ? FOLDED_HEIGHT : SHEET_HEIGHT,
    );
    return () => {
      root.style.removeProperty("--ai-sheet-width");
      root.style.removeProperty("--ai-sheet-height");
    };
  }, [open, collapsed]);

  // Focus the input once it shows after opening, where a keyboard won't
  // cover the design.
  const ready =
    open && availability?.configured === true && messages !== undefined;
  useEffect(() => {
    if (ready && window.matchMedia("(min-width: 1024px)").matches)
      inputRef.current?.focus();
  }, [ready]);

  // What a snapshot draws: the design as it is when the snapshot is taken.
  const current = useRef({ design, fields, assets, view, revision });
  useEffect(() => {
    current.current = { design, fields, assets, view, revision };
  });

  const snapshot = useCallback(async () => {
    const { design, fields, assets, view } = current.current;
    return await takeSnapshot({ design, fields, assets, view });
  }, []);

  const latest = messages?.at(-1);
  const working = isWorking(latest) || sending !== undefined;
  const limitReached =
    availability !== undefined && availability.used >= availability.limit;
  const blocked = limitReached || restingToday;

  const submit = async (text: string) => {
    const words = text.trim();
    if (!words || working || blocked) return;
    setDraft("");
    setSending(words);
    try {
      let shot: Id<"_storage"> | undefined;
      try {
        shot = await upload((await snapshot()).image);
      } catch (error) {
        // The words go without the picture rather than not at all.
        console.warn("The AI designer's snapshot failed:", error);
      }
      await send({
        designId,
        text: words,
        locale,
        view: viewName(current.current.view),
        snapshot: shot,
      });
    } catch (error) {
      const code = error instanceof ConvexError ? error.data : undefined;
      if (code === "ai-limit-total") setRestingToday(true);
      else if (code === "ai-busy") toast(t("ai.stillWorking"));
      else if (code !== "ai-limit" && code !== "ai-unavailable")
        toast.error(t("ai.notSent"));
      setDraft((now) => now || words);
    } finally {
      setSending(undefined);
    }
  };

  // A reply asked to see the design: while the sheet is open, the studio
  // draws it as it shows it once its revision has arrived here, and measures
  // its words. Simple mode's view of the collection may answer it instead.
  const asked =
    open &&
    latest?.status === "rendering" &&
    latest.rendering &&
    revision >= latest.rendering.revision
      ? { messageId: latest._id, toolUseId: latest.rendering.toolUseId }
      : undefined;
  const askedId = asked?.toolUseId;
  const askedMessage = asked?.messageId;
  useEffect(() => {
    if (askedId && askedMessage)
      void answerRendering(
        { messageId: askedMessage, toolUseId: askedId },
        current.current,
      );
  }, [askedId, askedMessage, answerRendering]);

  const onUndo = useCallback(
    async (messageId: Id<"aiMessages">, change: number) => {
      try {
        await undo({ messageId, change });
      } catch {
        toast.error(t("ai.undoFailed"));
      }
    },
    [undo, t],
  );

  // Closing hands the focus back to the button that opened the sheet.
  const close = () => {
    setOpen(false);
    triggerRef.current?.focus();
  };

  const left = availability ? availability.limit - availability.used : 0;
  const notice = restingToday
    ? t("ai.limitTotal")
    : limitReached
      ? t("ai.limit")
      : availability && left <= FEW_LEFT
        ? left === 1
          ? t("ai.leftOne")
          : t("ai.leftMany", { count: left })
        : undefined;

  const suggestions = [
    t("ai.warmer"),
    design.occasion === "christening"
      ? t("ai.dateUnderChild")
      : t("ai.dateUnderNames"),
    design.kind === "invitation" ? t("ai.writeWording") : t("ai.airier"),
  ];

  const body =
    availability === undefined ||
    (availability.configured && messages === undefined) ? (
      <div className="space-y-3 p-5">
        <Skeleton className="h-5 w-2/3" />
        <Skeleton className="h-16" />
      </div>
    ) : !availability.configured ? (
      <div className="flex flex-1 flex-col justify-center gap-3 px-6 py-8">
        <Sparkles className="size-6 text-gold" aria-hidden />
        <h3 className="font-display text-2xl leading-tight">
          {t("ai.soonTitle")}
        </h3>
        <p className="text-[15px] leading-relaxed text-muted-foreground">
          {t("ai.soonLead")}
        </p>
      </div>
    ) : (
      <>
        <Conversation
          messages={messages ?? []}
          sending={sending}
          revision={revision}
          suggestions={suggestions}
          lead={t("ai.lead")}
          onSuggestion={(text) => void submit(text)}
          onUndo={onUndo}
          onRetry={(messageId) => void retry(messageId)}
        />
        <Composer
          draft={draft}
          onDraftChange={setDraft}
          onSend={() => void submit(draft)}
          onStop={() => {
            if (latest && isWorking(latest))
              void stop({ messageId: latest._id }).catch(() => {});
          }}
          working={working}
          blocked={blocked}
          notice={notice}
          inputRef={inputRef}
        />
      </>
    );

  return (
    <>
      <Button
        ref={triggerRef}
        variant={open ? "secondary" : "outline"}
        size="sm"
        className="px-2.5 sm:px-3.5"
        aria-expanded={open}
        aria-controls={sheetId}
        onClick={() => {
          setOpen((now) => !now);
          setCollapsed(false);
        }}
      >
        <Sparkles aria-hidden className="text-gold" />
        <span className="sr-only sm:not-sr-only">{t("design.ai")}</span>
        {availability?.configured === false ? (
          <Badge variant="gold" className="hidden sm:inline-flex">
            {t("common.soon")}
          </Badge>
        ) : null}
      </Button>
      {mounted && open
        ? createPortal(
            <aside
              id={sheetId}
              aria-label={t("ai.title")}
              onKeyDown={(event) => {
                if (event.key === "Escape") close();
              }}
              className={cn(
                "fixed inset-x-0 bottom-0 z-40 flex h-(--ai-sheet-height) flex-col overflow-hidden rounded-t-2xl border-t border-border/70 bg-card text-card-foreground shadow-[0_-16px_40px_rgba(43,38,32,0.16)]",
                "lg:top-14 lg:left-auto lg:h-auto lg:w-(--ai-sheet-width) lg:rounded-none lg:border-t-0 lg:border-l lg:shadow-none",
              )}
            >
              <header className="flex h-14 shrink-0 items-center gap-2.5 border-b border-border/70 px-4">
                <Sparkles className="size-4 text-gold" aria-hidden />
                <h2 className="font-display text-xl leading-none">
                  {t("ai.title")}
                </h2>
                {collapsed && working ? (
                  <span className="truncate text-xs text-muted-foreground lg:hidden">
                    {t("ai.working")}
                  </span>
                ) : null}
                <div className="ml-auto flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-8 lg:hidden"
                    aria-label={collapsed ? t("ai.expand") : t("ai.collapse")}
                    title={collapsed ? t("ai.expand") : t("ai.collapse")}
                    onClick={() => setCollapsed((now) => !now)}
                  >
                    {collapsed ? (
                      <ChevronUp aria-hidden />
                    ) : (
                      <ChevronDown aria-hidden />
                    )}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-8"
                    aria-label={t("ai.close")}
                    title={t("ai.close")}
                    onClick={close}
                  >
                    <X aria-hidden />
                  </Button>
                </div>
              </header>
              <div
                className={cn(
                  "flex min-h-0 flex-1 flex-col",
                  collapsed && "max-lg:hidden",
                )}
              >
                {body}
              </div>
            </aside>,
            window.document.body,
          )
        : null}
    </>
  );
}
