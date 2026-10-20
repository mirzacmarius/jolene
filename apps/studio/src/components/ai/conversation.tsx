"use client";

import type { api } from "@jolene/backend/convex/_generated/api";
import type { Id } from "@jolene/backend/convex/_generated/dataModel";
import { Button } from "@jolene/ui/button";
import { cn } from "@jolene/ui/utils";
import type { FunctionReturnType } from "convex/server";
import {
  Hourglass,
  LoaderCircle,
  PenLine,
  RotateCcw,
  Sparkles,
  Undo2,
  UserRound,
} from "lucide-react";
import { useLayoutEffect, useRef, useState } from "react";
import { useI18n } from "@/locales/client";

export type Message = FunctionReturnType<typeof api.ai.messages>[number];
type Change = Message["changes"][number];

/** A reply still being written, or waiting to be. */
export const isWorking = (message: Message | undefined) =>
  message?.status === "waiting" ||
  message?.status === "pending" ||
  message?.status === "streaming" ||
  message?.status === "rendering";

/**
 * The design's conversation with the AI designer: the couple's words, the
 * replies as they are written, and a card for each change, to undo it.
 */
export function Conversation({
  messages,
  sending,
  revision,
  suggestions,
  lead,
  onSuggestion,
  onUndo,
  onRetry,
}: {
  messages: Message[];
  /** The couple's words on their way, shown until the message is saved. */
  sending: string | undefined;
  /** The design's revision, to tell whether later changes would go too. */
  revision: number;
  suggestions: string[];
  lead: string;
  onSuggestion: (text: string) => void;
  onUndo: (messageId: Id<"aiMessages">, change: number) => Promise<void>;
  onRetry: (messageId: Id<"aiMessages">) => void;
}) {
  const t = useI18n();
  const list = useRef<HTMLDivElement>(null);
  const pinned = useRef(true);
  const last = messages.at(-1);

  // Follows the reply as it grows, unless the couple scrolled up to read.
  const onScroll = () => {
    const element = list.current;
    if (element)
      pinned.current =
        element.scrollHeight - element.scrollTop - element.clientHeight < 80;
  };
  useLayoutEffect(() => {
    const element = list.current;
    if (element && pinned.current) element.scrollTop = element.scrollHeight;
  }, [
    last?.text,
    last?.notes.length,
    last?.changes.length,
    messages.length,
    sending,
  ]);

  if (messages.length === 0 && sending === undefined)
    return (
      <div className="flex min-h-0 flex-1 flex-col justify-end gap-4 overflow-y-auto px-5 py-6">
        <Sparkles className="size-6 text-gold" aria-hidden />
        <p className="text-[15px] leading-relaxed text-muted-foreground">
          {lead}
        </p>
        <div className="space-y-2">
          <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
            {t("ai.try")}
          </p>
          <div className="flex flex-wrap gap-2">
            {suggestions.map((suggestion) => (
              <Button
                key={suggestion}
                variant="outline"
                size="sm"
                className="h-auto min-h-8 py-1.5 whitespace-normal text-left"
                onClick={() => onSuggestion(suggestion)}
              >
                {suggestion}
              </Button>
            ))}
          </div>
        </div>
      </div>
    );

  return (
    <div
      ref={list}
      onScroll={onScroll}
      role="log"
      aria-busy={isWorking(last) || sending !== undefined}
      className="min-h-0 flex-1 space-y-5 overflow-y-auto px-4 py-5"
    >
      {messages.map((message) =>
        message.role === "couple" ? (
          <CoupleWords key={message._id} text={message.text} />
        ) : (
          <Reply
            key={message._id}
            message={message}
            revision={revision}
            onUndo={onUndo}
            onRetry={onRetry}
          />
        ),
      )}
      {sending !== undefined ? (
        <>
          <CoupleWords text={sending} />
          <Status icon="spinner">{t("ai.sending")}</Status>
        </>
      ) : null}
    </div>
  );
}

function CoupleWords({ text }: { text: string }) {
  return (
    <p className="ml-auto w-fit max-w-[85%] rounded-2xl rounded-br-md bg-secondary px-3.5 py-2 text-[15px] leading-relaxed break-words whitespace-pre-wrap text-secondary-foreground">
      {text}
    </p>
  );
}

function Status({
  icon,
  children,
}: {
  icon: "spinner" | "sparkles" | "waiting";
  children: string;
}) {
  return (
    <p className="flex items-center gap-2 text-[13px] text-muted-foreground">
      {icon === "spinner" ? (
        <LoaderCircle className="size-3.5 animate-spin" aria-hidden />
      ) : icon === "waiting" ? (
        <Hourglass className="size-3.5" aria-hidden />
      ) : (
        <Sparkles className="size-3.5 animate-pulse text-gold" aria-hidden />
      )}
      {children}
    </p>
  );
}

function Reply({
  message,
  revision,
  onUndo,
  onRetry,
}: {
  message: Message;
  revision: number;
  onUndo: (messageId: Id<"aiMessages">, change: number) => Promise<void>;
  onRetry: (messageId: Id<"aiMessages">) => void;
}) {
  const t = useI18n();
  const busy = isWorking(message);
  const errors = {
    refused: t("ai.refused"),
    busy: t("ai.busy"),
    unavailable: t("ai.unavailable"),
    failed: t("ai.failed"),
  };
  return (
    <div className="space-y-2.5">
      {busy && message.notes.length > 0 ? (
        <ul className="space-y-1 border-l-2 border-gold/40 pl-3">
          {message.notes.slice(-4).map((note, index) => (
            <li
              // Notes only grow, so their place names them.
              // biome-ignore lint/suspicious/noArrayIndexKey: see above
              key={index}
              className="text-[13px] leading-snug text-muted-foreground italic"
            >
              {note}
            </li>
          ))}
        </ul>
      ) : null}
      {message.text ? (
        <p className="text-[15px] leading-relaxed break-words whitespace-pre-wrap">
          {message.text}
        </p>
      ) : null}
      {message.changes.length > 0 ? (
        <ul className="space-y-1.5">
          {message.changes.map((change, index) => (
            <ChangeCard
              // A reply's changes only grow, in order.
              // biome-ignore lint/suspicious/noArrayIndexKey: see above
              key={index}
              change={change}
              laterChanges={
                change.kind === "design" && revision > change.revision
              }
              onUndo={() => onUndo(message._id, index)}
            />
          ))}
        </ul>
      ) : null}
      {message.status === "waiting" ? (
        <Status icon="waiting">{t("ai.waiting")}</Status>
      ) : message.status === "pending" ? (
        <Status icon="sparkles">{t("ai.thinking")}</Status>
      ) : message.status === "streaming" ? (
        <Status icon="sparkles">{t("ai.working")}</Status>
      ) : message.status === "rendering" ? (
        <Status icon="sparkles">{t("ai.looking")}</Status>
      ) : message.status === "stopped" ? (
        <p className="text-[13px] text-muted-foreground">{t("ai.stopped")}</p>
      ) : message.status === "failed" ? (
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-[13px] text-destructive">
            {errors[message.error ?? "failed"]}
          </p>
          {message.canRetry ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => onRetry(message._id)}
            >
              <RotateCcw aria-hidden />
              {t("ai.retry")}
            </Button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function ChangeCard({
  change,
  laterChanges,
  onUndo,
}: {
  change: Change;
  /** The design changed after it, so undoing it takes those back too. */
  laterChanges: boolean;
  onUndo: () => Promise<void>;
}) {
  const t = useI18n();
  const [confirming, setConfirming] = useState(false);
  const [undoing, setUndoing] = useState(false);
  const undone = change.undoneAt !== undefined;
  const undo = async () => {
    setUndoing(true);
    try {
      await onUndo();
    } finally {
      setUndoing(false);
      setConfirming(false);
    }
  };
  const Icon = change.kind === "details" ? UserRound : PenLine;
  return (
    <li
      className={cn(
        "rounded-xl border border-border/70 bg-background px-3 py-2",
        undone && "bg-transparent",
      )}
    >
      <div className="flex items-center gap-2.5">
        <Icon
          className={cn(
            "size-4 shrink-0",
            undone ? "text-muted-foreground/60" : "text-gold",
          )}
          aria-hidden
        />
        <p
          className={cn(
            "min-w-0 flex-1 text-[13px] leading-snug",
            undone && "text-muted-foreground line-through",
          )}
        >
          {change.kind === "details" ? `${t("ai.detailsChanged")}: ` : ""}
          {change.note}
        </p>
        {undone ? (
          <span className="shrink-0 text-xs text-muted-foreground">
            {t("ai.undone")}
          </span>
        ) : confirming ? null : (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 shrink-0 px-2.5"
            disabled={undoing}
            onClick={() => (laterChanges ? setConfirming(true) : undo())}
          >
            {undoing ? (
              <LoaderCircle className="animate-spin" aria-hidden />
            ) : (
              <Undo2 aria-hidden />
            )}
            {t("ai.undo")}
          </Button>
        )}
      </div>
      {confirming && !undone ? (
        <div className="mt-2 space-y-2 border-t border-border/60 pt-2">
          <p className="text-[13px] text-muted-foreground">
            {t("ai.undoLater")}
          </p>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" disabled={undoing} onClick={undo}>
              {undoing ? (
                <LoaderCircle className="animate-spin" aria-hidden />
              ) : (
                <Undo2 aria-hidden />
              )}
              {t("ai.undoAll")}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setConfirming(false)}
            >
              {t("ai.cancel")}
            </Button>
          </div>
        </div>
      ) : null}
    </li>
  );
}
