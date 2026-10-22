"use client";

import {
  type DesignDocument,
  duplicateLayers,
  type FaceRef,
  type Operation,
  type Restack,
  removeLayers,
  restackLayers,
} from "@jolene/design";
import {
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuShortcut,
} from "@jolene/ui/context-menu";
import { Tooltip } from "@jolene/ui/tooltip";
import { cn } from "@jolene/ui/utils";
import {
  ArrowDownToLine,
  ArrowUpToLine,
  Copy,
  Lock,
  LockOpen,
  Trash2,
} from "lucide-react";
import { useI18n } from "@/locales/client";
import { useDeleteKeyLabel, useShortcutLabel } from "./keyboard";

/** Copies land this far down and right of their originals, in millimetres. */
const COPY_OFFSET_MM = 3;

export interface LayerActions {
  /** Some of the layers can be deleted: the locked ones stay. */
  deletable: boolean;
  /** Every one of them is locked. */
  locked: boolean;
  duplicate: () => void;
  /** Deletes all but the locked layers, which stay selected. */
  remove: () => void;
  lock: (locked: boolean) => void;
  restack: (how: Restack) => void;
  /** Whether restacking would move any of them. */
  canRestack: (how: Restack) => boolean;
}

/**
 * What can be done to the selected layers of a face, wherever the visitor
 * asks for it: the bar beside them, the right-click menu, the inspector or
 * the keyboard. Each is one step in the history.
 */
export function layerActions({
  document,
  target,
  ids,
  apply,
  onSelect,
}: {
  document: DesignDocument;
  target: FaceRef;
  ids: readonly string[];
  apply: (operations: Operation[]) => void;
  onSelect: (ids: string[]) => void;
}): LayerActions {
  const layers = (
    document.pieces.find((piece) => piece.id === target.piece)?.[target.face]
      ?.layers ?? []
  ).filter((layer) => ids.includes(layer.id));
  return {
    deletable: layers.some((layer) => !layer.locked),
    locked: layers.length > 0 && layers.every((layer) => layer.locked),
    duplicate: () => {
      if (layers.length === 0) return;
      const copies = duplicateLayers(document, target, ids, COPY_OFFSET_MM);
      apply(copies.operations);
      onSelect(copies.ids);
    },
    remove: () => {
      const { operations, kept } = removeLayers(document, target, ids);
      if (operations.length === 0) return;
      apply(operations);
      onSelect(kept);
    },
    lock: (locked) =>
      apply(
        layers
          .filter((layer) => layer.locked !== locked)
          .map((layer) => ({
            op: "updateLayer" as const,
            ...target,
            layer: layer.id,
            set: { locked },
          })),
      ),
    restack: (how) => apply(restackLayers(document, target, ids, how)),
    canRestack: (how) => restackLayers(document, target, ids, how).length > 0,
  };
}

const actionButton =
  "flex size-7 items-center justify-center rounded-full text-muted-foreground outline-none transition-colors hover:bg-secondary hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50 [&_svg]:size-4";

/**
 * Duplicate and delete, as two small buttons; while every layer is locked,
 * the lock takes delete's place, to unlock them first. Like the lock in the
 * layers panel, its icon says what the layers are, its label what it does.
 */
export function LayerActionButtons({
  actions,
  className,
}: {
  actions: LayerActions;
  className?: string;
}) {
  const t = useI18n();
  const shortcut = useShortcutLabel();
  const deleteKey = useDeleteKeyLabel();
  return (
    <div className={cn("flex items-center gap-0.5", className)}>
      <Tooltip label={t("expert.actions.duplicate")} shortcut={shortcut("D")}>
        <button
          type="button"
          onClick={actions.duplicate}
          aria-label={t("expert.actions.duplicate")}
          className={actionButton}
        >
          <Copy aria-hidden />
        </button>
      </Tooltip>
      {actions.locked ? (
        <Tooltip label={t("expert.layers.unlock")}>
          <button
            type="button"
            onClick={() => actions.lock(false)}
            aria-label={t("expert.layers.unlock")}
            className={actionButton}
          >
            <Lock aria-hidden />
          </button>
        </Tooltip>
      ) : (
        <Tooltip label={t("expert.actions.delete")} shortcut={deleteKey}>
          <button
            type="button"
            onClick={actions.remove}
            aria-label={t("expert.actions.delete")}
            aria-keyshortcuts="Delete Backspace"
            className={cn(actionButton, "hover:text-destructive")}
          >
            <Trash2 aria-hidden />
          </button>
        </Tooltip>
      )}
    </div>
  );
}

/**
 * The right-click menu of the selected layers, on the canvas and in the
 * layers panel: copy, delete, restack, lock.
 */
export function LayerMenuContent({ actions }: { actions: LayerActions }) {
  const t = useI18n();
  const shortcut = useShortcutLabel();
  const deleteKey = useDeleteKeyLabel();
  return (
    <ContextMenuContent className="min-w-56">
      <ContextMenuItem onSelect={actions.duplicate}>
        <Copy aria-hidden />
        {t("expert.actions.duplicate")}
        <ContextMenuShortcut>{shortcut("D")}</ContextMenuShortcut>
      </ContextMenuItem>
      <ContextMenuItem onSelect={actions.remove} disabled={!actions.deletable}>
        <Trash2 aria-hidden />
        {t("expert.actions.delete")}
        <ContextMenuShortcut>{deleteKey}</ContextMenuShortcut>
      </ContextMenuItem>
      <ContextMenuSeparator />
      <ContextMenuItem
        onSelect={() => actions.restack("front")}
        disabled={!actions.canRestack("front")}
      >
        <ArrowUpToLine aria-hidden />
        {t("expert.arrange.front")}
      </ContextMenuItem>
      <ContextMenuItem
        onSelect={() => actions.restack("back")}
        disabled={!actions.canRestack("back")}
      >
        <ArrowDownToLine aria-hidden />
        {t("expert.arrange.back")}
      </ContextMenuItem>
      <ContextMenuSeparator />
      <ContextMenuItem onSelect={() => actions.lock(!actions.locked)}>
        {actions.locked ? <LockOpen aria-hidden /> : <Lock aria-hidden />}
        {actions.locked ? t("expert.layers.unlock") : t("expert.layers.lock")}
      </ContextMenuItem>
    </ContextMenuContent>
  );
}
