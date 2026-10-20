"use client";

import {
  type DesignDocument,
  type FaceRef,
  type Layer,
  type Operation,
  type Piece,
  replaceLayer,
  restackLayers,
} from "@jolene/design";
import { cn } from "@jolene/ui/utils";
import { Eye, EyeOff, Lock, LockOpen } from "lucide-react";
import {
  type KeyboardEvent,
  memo,
  type PointerEvent as ReactPointerEvent,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { useI18n } from "@/locales/client";
import { AddMenu, type Artwork } from "./add-menu";
import { kindIcons, layerKind, useLayerLabel } from "./layer-label";

/** How far a row is dragged before it moves, in pixels. */
const DRAG_PX = 4;

interface Drag {
  id: string;
  pointerId: number;
  startY: number;
  /** The gap the row would drop into, counted from the top; null until it moves. */
  gap: number | null;
}

/**
 * The face's layers, the frontmost on top. Click selects (Cmd/Ctrl adds,
 * Shift selects a run), double-click renames, the eye and the lock hide and
 * lock, and a row drags to another place; Alt with the arrows moves the
 * focused one. It draws again only when what it shows changes, not while
 * the canvas or the inspector preview a change.
 */
export const LayersPanel = memo(function LayersPanel({
  document,
  piece,
  target,
  selection,
  onSelect,
  hovered,
  onHover,
  apply,
  artwork,
  onAdded,
}: {
  document: DesignDocument;
  piece: Piece;
  target: FaceRef;
  selection: readonly string[];
  onSelect: (ids: string[]) => void;
  hovered: string | null;
  onHover: (id: string | null) => void;
  apply: (operations: Operation[]) => void;
  artwork: readonly Artwork[] | undefined;
  onAdded: (id: string, kind: "text" | "other") => void;
}) {
  const t = useI18n();
  const label = useLayerLabel();
  const layers = piece[target.face]?.layers ?? [];
  // Frontmost first, as the layers stack over each other.
  const rows = [...layers].reverse();
  const list = useRef<HTMLUListElement>(null);
  const anchor = useRef<string | null>(null);
  const [renaming, setRenaming] = useState<string | null>(null);
  const [drag, setDrag] = useState<Drag | null>(null);
  const dragged = useRef(false);
  const refocus = useRef<string | null>(null);

  // A row moved in the list keeps the keyboard's focus.
  useLayoutEffect(() => {
    const id = refocus.current;
    if (!id) return;
    refocus.current = null;
    list.current
      ?.querySelector<HTMLElement>(`[data-row="${CSS.escape(id)}"]`)
      ?.focus();
  });

  const update = (layer: Layer, set: Record<string, unknown>) =>
    apply([{ op: "updateLayer", ...target, layer: layer.id, set }]);

  const choose = (
    id: string,
    { toggle, range }: { toggle: boolean; range: boolean },
  ) => {
    if (range && anchor.current) {
      const from = rows.findIndex((row) => row.id === anchor.current);
      const to = rows.findIndex((row) => row.id === id);
      if (from >= 0 && to >= 0) {
        const run = rows
          .slice(Math.min(from, to), Math.max(from, to) + 1)
          .map((row) => row.id);
        onSelect(toggle ? [...new Set([...selection, ...run])] : run);
        return;
      }
    }
    anchor.current = id;
    if (toggle)
      onSelect(
        selection.includes(id)
          ? selection.filter((selected) => selected !== id)
          : [...selection, id],
      );
    else onSelect([id]);
  };

  const rename = (layer: Layer, name: string) => {
    setRenaming(null);
    const next = name.trim();
    if (next === (layer.name ?? "")) return;
    if (next) update(layer, { name: next });
    else {
      // An operation can't take a name away; the layer goes back without one.
      const { name: _name, ...unnamed } = layer;
      apply(replaceLayer(document, target, unnamed as Layer));
    }
  };

  const restack = (layer: Layer, how: "forward" | "backward") => {
    const operations = restackLayers(document, target, [layer.id], how);
    if (operations.length === 0) return;
    refocus.current = layer.id;
    apply(operations);
  };

  const onRowKeyDown = (
    event: KeyboardEvent<HTMLButtonElement>,
    layer: Layer,
  ) => {
    const index = rows.findIndex((row) => row.id === layer.id);
    if (event.key === "ArrowUp" || event.key === "ArrowDown") {
      event.preventDefault();
      if (event.altKey) {
        restack(layer, event.key === "ArrowUp" ? "forward" : "backward");
        return;
      }
      const next = rows[index + (event.key === "ArrowUp" ? -1 : 1)];
      if (!next) return;
      list.current
        ?.querySelector<HTMLElement>(`[data-row="${CSS.escape(next.id)}"]`)
        ?.focus();
      if (event.shiftKey) choose(next.id, { toggle: true, range: true });
    } else if (event.key === "F2") {
      event.preventDefault();
      setRenaming(layer.id);
    }
  };

  // Dragging a row: the gap it would drop into follows the pointer.
  const gapAt = (clientY: number) => {
    const elements = [
      ...(list.current?.querySelectorAll<HTMLElement>("[data-row]") ?? []),
    ];
    const gap = elements.findIndex((element) => {
      const rect = element.getBoundingClientRect();
      return clientY < rect.top + rect.height / 2;
    });
    return gap < 0 ? elements.length : gap;
  };
  const onRowPointerDown = (
    event: ReactPointerEvent<HTMLButtonElement>,
    layer: Layer,
  ) => {
    if (event.button !== 0 || renaming) return;
    dragged.current = false;
    setDrag({
      id: layer.id,
      pointerId: event.pointerId,
      startY: event.clientY,
      gap: null,
    });
  };
  const onRowPointerMove = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (!drag || drag.pointerId !== event.pointerId) return;
    if (drag.gap === null) {
      if (Math.abs(event.clientY - drag.startY) < DRAG_PX) return;
      event.currentTarget.setPointerCapture(event.pointerId);
      dragged.current = true;
    }
    const gap = gapAt(event.clientY);
    if (gap !== drag.gap) setDrag({ ...drag, gap });
  };
  const onRowPointerUp = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (!drag || drag.pointerId !== event.pointerId) return;
    setDrag(null);
    if (drag.gap === null) return;
    const below = rows
      .slice(drag.gap)
      .filter((row) => row.id !== drag.id).length;
    const from = layers.findIndex((layer) => layer.id === drag.id);
    if (from >= 0 && below !== from)
      apply([{ op: "moveLayer", ...target, layer: drag.id, index: below }]);
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center justify-between gap-2 px-4 pt-4 pb-2">
        <h2 className="text-[11px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
          {t("expert.layers.title")}
        </h2>
        <AddMenu
          document={document}
          piece={piece}
          target={target}
          artwork={artwork}
          apply={apply}
          onAdded={onAdded}
        />
      </div>
      {rows.length === 0 ? (
        <p className="px-4 py-6 text-sm text-muted-foreground">
          {t("expert.layers.empty")}
        </p>
      ) : (
        <ul
          ref={list}
          aria-label={t("expert.layers.title")}
          className="min-h-0 flex-1 overflow-y-auto px-2 pb-3"
        >
          {rows.map((layer, row) => {
            const selected = selection.includes(layer.id);
            const Icon = kindIcons[layerKind(layer)];
            const name = label(layer);
            return (
              <li
                key={layer.id}
                className={cn(
                  "group relative flex h-8 items-center gap-1 rounded-lg pr-1 text-[13px]",
                  selected
                    ? "bg-accent text-accent-foreground"
                    : hovered === layer.id
                      ? "bg-secondary"
                      : "hover:bg-secondary/70",
                  drag?.id === layer.id && drag.gap !== null && "opacity-50",
                )}
                onPointerEnter={() => onHover(layer.id)}
                onPointerLeave={() => onHover(null)}
              >
                {drag && drag.gap === row ? <DropLine edge="top" /> : null}
                {drag && drag.gap === rows.length && row === rows.length - 1 ? (
                  <DropLine edge="bottom" />
                ) : null}
                {renaming === layer.id ? (
                  <RenameField
                    initial={layer.name ?? ""}
                    placeholder={name}
                    label={t("expert.layers.rename")}
                    onDone={(value) =>
                      value === null ? setRenaming(null) : rename(layer, value)
                    }
                  />
                ) : (
                  <button
                    type="button"
                    data-row={layer.id}
                    aria-pressed={selected}
                    aria-keyshortcuts="Alt+ArrowUp Alt+ArrowDown F2"
                    title={name}
                    onClick={(event) => {
                      if (dragged.current) {
                        dragged.current = false;
                        return;
                      }
                      choose(layer.id, {
                        toggle: event.metaKey || event.ctrlKey,
                        range: event.shiftKey,
                      });
                    }}
                    onDoubleClick={() => setRenaming(layer.id)}
                    onKeyDown={(event) => onRowKeyDown(event, layer)}
                    onPointerDown={(event) => onRowPointerDown(event, layer)}
                    onPointerMove={onRowPointerMove}
                    onPointerUp={onRowPointerUp}
                    onPointerCancel={() => setDrag(null)}
                    className={cn(
                      "flex h-full min-w-0 flex-1 items-center gap-2 rounded-lg pl-2.5 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
                      layer.hidden && "text-muted-foreground",
                    )}
                  >
                    <Icon
                      className="size-3.5 shrink-0 text-muted-foreground"
                      aria-hidden
                    />
                    <span className={cn("truncate", layer.hidden && "italic")}>
                      {name}
                    </span>
                  </button>
                )}
                <RowToggle
                  on={layer.hidden}
                  label={
                    layer.hidden
                      ? t("expert.layers.show")
                      : t("expert.layers.hide")
                  }
                  onClick={() => update(layer, { hidden: !layer.hidden })}
                >
                  {layer.hidden ? <EyeOff /> : <Eye />}
                </RowToggle>
                <RowToggle
                  on={layer.locked}
                  label={
                    layer.locked
                      ? t("expert.layers.unlock")
                      : t("expert.layers.lock")
                  }
                  onClick={() => update(layer, { locked: !layer.locked })}
                >
                  {layer.locked ? <Lock /> : <LockOpen />}
                </RowToggle>
              </li>
            );
          })}
        </ul>
      )}
      <p className="border-t border-border/70 px-4 py-2.5 text-[11px] leading-snug text-muted-foreground">
        {t("expert.layers.hint")}
      </p>
    </div>
  );
});

function DropLine({ edge }: { edge: "top" | "bottom" }) {
  return (
    <span
      className={cn(
        "pointer-events-none absolute right-1 left-1 h-0.5 rounded-full bg-[#2563eb]",
        edge === "top" ? "-top-px" : "-bottom-px",
      )}
      aria-hidden
    />
  );
}

/** The eye or the lock: shown when on, or while the row is pointed at. */
function RowToggle({
  on,
  label,
  onClick,
  children,
}: {
  on: boolean;
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={on}
      aria-label={label}
      title={label}
      onClick={onClick}
      className={cn(
        "flex size-6 shrink-0 items-center justify-center rounded-md text-muted-foreground outline-none hover:bg-card hover:text-foreground focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-ring/50 [&_svg]:size-3.5",
        on ? "opacity-100" : "opacity-0 group-hover:opacity-100",
      )}
    >
      {children}
    </button>
  );
}

/** A layer's name being written in place; null when given up. */
function RenameField({
  initial,
  placeholder,
  label,
  onDone,
}: {
  initial: string;
  placeholder: string;
  label: string;
  onDone: (value: string | null) => void;
}) {
  const [value, setValue] = useState(initial);
  const done = useRef(false);
  const finish = (result: string | null) => {
    if (done.current) return;
    done.current = true;
    onDone(result);
  };
  return (
    <input
      // biome-ignore lint/a11y/noAutofocus: renaming starts by asking for the name
      autoFocus
      aria-label={label}
      value={value}
      placeholder={placeholder}
      maxLength={80}
      onFocus={(event) => event.currentTarget.select()}
      onChange={(event) => setValue(event.target.value)}
      onBlur={() => finish(value)}
      onKeyDown={(event) => {
        if (event.key === "Enter") finish(value);
        if (event.key === "Escape") {
          event.preventDefault();
          finish(null);
        }
      }}
      className="h-7 min-w-0 flex-1 rounded-md border border-ring bg-card px-2 text-[13px] outline-none ring-[3px] ring-ring/30"
    />
  );
}
