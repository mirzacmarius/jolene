"use client";

import { api } from "@jolene/backend/convex/_generated/api";
import type { Id } from "@jolene/backend/convex/_generated/dataModel";
import { toast } from "@jolene/ui/toaster";
import { useMutation } from "convex/react";
import { ConvexError } from "convex/values";
import { useCallback } from "react";
import { useI18n } from "@/locales/client";

/**
 * Runs a failed reply again (ai.retry), and says why when it can't: a reply
 * the API never answered counts again, so the day's messages may be gone.
 */
export function useRetry() {
  const t = useI18n();
  const retry = useMutation(api.ai.retry);
  return useCallback(
    async (messageId: Id<"aiMessages">) => {
      try {
        await retry({ messageId });
      } catch (error) {
        const code = error instanceof ConvexError ? error.data : undefined;
        toast.error(
          code === "ai-limit"
            ? t("ai.limit")
            : code === "ai-limit-total"
              ? t("ai.limitTotal")
              : code === "ai-unavailable"
                ? t("ai.unavailable")
                : t("common.error"),
        );
      }
    },
    [retry, t],
  );
}
