"use client";

import { Button } from "@jolene/ui/button";
import { cn } from "@jolene/ui/utils";
import { ArrowUp, Square } from "lucide-react";
import { type RefObject, useId } from "react";
import { useI18n } from "@/locales/client";

/** The longest message the AI designer reads (the backend's limit too). */
export const MAX_MESSAGE_LENGTH = 2000;

/**
 * Where the couple writes to the AI designer. Enter sends; Shift+Enter starts
 * a new line. While a reply is written, Stop takes Send's place.
 */
export function Composer({
  draft,
  onDraftChange,
  onSend,
  onStop,
  working,
  blocked,
  notice,
  inputRef,
}: {
  draft: string;
  onDraftChange: (draft: string) => void;
  onSend: () => void;
  onStop: () => void;
  /** A reply is on its way: it can be stopped, and nothing more sent. */
  working: boolean;
  /** No more messages can be sent (today's limit); the notice says why. */
  blocked: boolean;
  notice: string | undefined;
  inputRef: RefObject<HTMLTextAreaElement | null>;
}) {
  const t = useI18n();
  const noticeId = useId();
  const canSend = !working && !blocked && draft.trim().length > 0;
  return (
    <form
      className="shrink-0 border-t border-border/70 bg-card p-3"
      onSubmit={(event) => {
        event.preventDefault();
        if (canSend) onSend();
      }}
    >
      <div
        className={cn(
          "flex items-end gap-2 rounded-2xl border border-input bg-background py-1.5 pr-1.5 pl-3.5 transition-[border-color,box-shadow] focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/25",
          blocked && "opacity-60",
        )}
      >
        <textarea
          ref={inputRef}
          value={draft}
          onChange={(event) => onDraftChange(event.target.value)}
          onKeyDown={(event) => {
            if (
              event.key === "Enter" &&
              !event.shiftKey &&
              !event.nativeEvent.isComposing
            ) {
              event.preventDefault();
              if (canSend) onSend();
            }
          }}
          rows={1}
          maxLength={MAX_MESSAGE_LENGTH}
          placeholder={t("ai.placeholder")}
          aria-label={t("ai.placeholder")}
          aria-describedby={notice ? noticeId : undefined}
          disabled={blocked}
          className="field-sizing-content max-h-40 min-h-8 flex-1 resize-none bg-transparent py-1 text-[15px] leading-6 outline-none placeholder:text-muted-foreground/70 disabled:cursor-not-allowed"
        />
        {working ? (
          <Button
            type="button"
            variant="secondary"
            size="icon"
            className="size-8"
            onClick={onStop}
            aria-label={t("ai.stop")}
            title={t("ai.stop")}
          >
            <Square className="size-3 fill-current" aria-hidden />
          </Button>
        ) : (
          <Button
            type="submit"
            size="icon"
            className="size-8"
            disabled={!canSend}
            aria-label={t("ai.send")}
            title={t("ai.send")}
          >
            <ArrowUp aria-hidden />
          </Button>
        )}
      </div>
      {notice ? (
        <p
          id={noticeId}
          className="mt-2 px-1 text-xs leading-snug text-muted-foreground"
        >
          {notice}
        </p>
      ) : null}
    </form>
  );
}
