"use client";

import {
  type Box,
  type DesignDocument,
  duplicateLayers,
  type FaceName,
  type FaceRef,
  type Frame,
  frameCentre,
  type Handle,
  hitLayer,
  type Layer,
  type LayerChanges,
  layersInBox,
  type Operation,
  type Piece,
  type Placement,
  type Point,
  placementBounds,
  previewLayers,
  resizeFrame,
  rotateTo,
  type SnapFace,
  type SnapGuide,
  snapBox,
  snapResize,
  unionBounds,
} from "@jolene/design";
import { FaceView, type RenderContext } from "@jolene/design/react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@jolene/ui/dropdown-menu";
import { Tooltip } from "@jolene/ui/tooltip";
import { cn } from "@jolene/ui/utils";
import { Minus, Plus } from "lucide-react";
import {
  memo,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useCurrentLocale, useI18n } from "@/locales/client";
import { isModifier, isShortcut, isTyping, useShortcutLabel } from "./keyboard";
import { type Outline, Overlay } from "./overlay";
import { PX_PER_MM, useViewport } from "./use-viewport";

/** The face's own drawing, which only draws again when the design changes. */
const Face = memo(FaceView);

/** How far the pointer goes before a press becomes a drag, in pixels. */
const DRAG_PX = 3;
/** How close a click must come to a layer to pick it, in pixels. */
const HIT_PX = 4;
/** How close a line must come to another to snap to it, in pixels. */
const SNAP_PX = 6;
/** Arrow keys move this far, and ten times as far with Shift, in millimetres. */
const NUDGE_MM = 0.5;
/** Copies land this far down and right of their originals, in millimetres. */
const COPY_OFFSET_MM = 3;
const NO_LAYERS: readonly Layer[] = [];
const NO_GUIDES: readonly SnapGuide[] = [];

type Session =
  /** The pointer is down and hasn't moved yet: a click, or a drag about to start. */
  | {
      kind: "press";
      pointerId: number;
      client: Point;
      at: Point;
      /** The layer pressed, if it is now selected. */
      layer: string | null;
      /** A click on one of several selected layers selects it alone. */
      narrow: boolean;
      additive: boolean;
    }
  | {
      kind: "move";
      pointerId: number;
      at: Point;
      start: ReadonlyMap<string, Placement>;
      dx: number;
      dy: number;
      guides: readonly SnapGuide[];
    }
  | {
      kind: "nudge";
      start: ReadonlyMap<string, Placement>;
      dx: number;
      dy: number;
    }
  | {
      kind: "resize";
      pointerId: number;
      id: string;
      handle: Handle;
      start: Placement;
      frame: Frame;
      guides: readonly SnapGuide[];
    }
  | {
      kind: "rotate";
      pointerId: number;
      id: string;
      start: Placement;
      from: Point;
      rotation: number;
    }
  | {
      kind: "marquee";
      pointerId: number;
      at: Point;
      to: Point;
      base: readonly string[];
    }
  | { kind: "pan"; pointerId: number; client: Point }
  | { kind: "pinch" };

const round = (value: number) => Math.round(value * 100) / 100;

/** How the renderer places a layer, for a preview drawn without React. */
function transformOf({ frame, rotation }: Placement) {
  const translate = `translate(${frame.x} ${frame.y})`;
  return rotation
    ? `${translate} rotate(${rotation} ${frame.width / 2} ${frame.height / 2})`
    : translate;
}

const shifted = (placement: Placement, dx: number, dy: number): Placement => ({
  rotation: placement.rotation,
  frame: {
    ...placement.frame,
    x: placement.frame.x + dx,
    y: placement.frame.y + dy,
  },
});

/** The upright box around a group of layers, as the marquee's corners give it. */
function boxBetween(a: Point, b: Point): Box {
  return {
    x: Math.min(a.x, b.x),
    y: Math.min(a.y, b.y),
    width: Math.abs(a.x - b.x),
    height: Math.abs(a.y - b.y),
  };
}

export interface CanvasProps {
  document: DesignDocument;
  piece: Piece;
  face: FaceName;
  context: RenderContext;
  /** Trim, bleed and safe margin. */
  guides: boolean;
  title: string;
  selection: readonly string[];
  onSelect: (ids: string[]) => void;
  hovered: string | null;
  onHover: (id: string | null) => void;
  /** Changes the inspector shows before it commits them. */
  preview: ReadonlyMap<string, LayerChanges>;
  apply: (operations: Operation[]) => void;
  /** Puts the cursor in a text layer's words, in the inspector. */
  onEditText: (id: string) => void;
}

/**
 * One face, editable: click to select (Shift adds), drag to move, the
 * handles to resize and turn, arrows to nudge. A drag shows as it goes
 * without the backend, and letting go applies it as one batch.
 */
export function Canvas({
  document,
  piece,
  face,
  context,
  guides,
  title,
  selection,
  onSelect,
  hovered,
  onHover,
  preview,
  apply,
  onEditText,
}: CanvasProps) {
  const t = useI18n();
  const shortcut = useShortcutLabel();
  const stage = useRef<HTMLDivElement>(null);
  const paper = useRef<HTMLDivElement>(null);
  const target: FaceRef = useMemo(
    () => ({ piece: piece.id, face }),
    [piece.id, face],
  );
  const bleed = guides ? piece.bleed : 0;
  const viewport = useViewport(
    stage,
    { width: piece.width, height: piece.height, bleed },
    `${piece.id}:${face}`,
  );
  const { view } = viewport;
  const snapFace: SnapFace = {
    width: piece.width,
    height: piece.height,
    bleed: piece.bleed,
    safeMargin: piece.safeMargin,
  };

  const [session, setSessionState] = useState<Session | null>(null);
  const sessionRef = useRef<Session | null>(null);
  const setSession = (next: Session | null) => {
    sessionRef.current = next;
    setSessionState(next);
  };
  const [panReady, setPanReady] = useState(false);
  const spaceHeld = useRef(false);
  const touches = useRef(new Map<number, Point>());

  // The face as it would be with the inspector's and the handles' changes.
  const changes = useMemo(() => {
    const all = new Map(preview);
    if (session?.kind === "resize")
      all.set(session.id, {
        ...all.get(session.id),
        frame: { ...session.frame },
      });
    return all;
  }, [preview, session]);
  const shown = useMemo(
    () => previewLayers(document, target, changes),
    [document, target, changes],
  );
  const shownLayers =
    shown.pieces.find((candidate) => candidate.id === piece.id)?.[face]
      ?.layers ?? NO_LAYERS;

  // Moving and turning are drawn by changing the layers' transforms on the
  // drawing itself, so the face doesn't draw again for every pointer move.
  const moved = useRef(new Map<Element, string | null>());
  const showTransforms = (transforms: ReadonlyMap<string, string>) => {
    const root = paper.current;
    if (!root) return;
    for (const [id, transform] of transforms) {
      const element = root.querySelector(`g[data-layer="${CSS.escape(id)}"]`);
      if (!element) continue;
      if (!moved.current.has(element))
        moved.current.set(element, element.getAttribute("transform"));
      element.setAttribute("transform", transform);
    }
  };
  const restoreTransforms = () => {
    for (const [element, original] of moved.current) {
      if (original === null) element.removeAttribute("transform");
      else element.setAttribute("transform", original);
    }
    moved.current.clear();
  };

  const layerById = (id: string) =>
    shownLayers.find((layer) => layer.id === id);
  /** The selected layers a drag or the arrows may move. */
  const movable = (ids: readonly string[]) =>
    ids.filter((id) => {
      const layer = layerById(id);
      return layer && !layer.locked;
    });
  const placementsOf = (ids: readonly string[]) =>
    new Map(
      ids.flatMap((id) => {
        const layer = layerById(id);
        return layer
          ? [[id, { frame: layer.frame, rotation: layer.rotation }] as const]
          : [];
      }),
    );
  const othersThan = (ids: readonly string[]) =>
    shownLayers
      .filter((layer) => !layer.hidden && !ids.includes(layer.id))
      .map(placementBounds);

  const toFace = (clientX: number, clientY: number): Point => {
    const rect = stage.current?.getBoundingClientRect();
    if (!rect || !view) return { x: 0, y: 0 };
    return {
      x: (clientX - rect.left - view.x) / view.scale,
      y: (clientY - rect.top - view.y) / view.scale,
    };
  };

  const moveOperations = (
    start: ReadonlyMap<string, Placement>,
    dx: number,
    dy: number,
  ): Operation[] =>
    [...start].map(([id, placement]) => ({
      op: "updateLayer",
      ...target,
      layer: id,
      set: {
        frame: {
          x: round(placement.frame.x + dx),
          y: round(placement.frame.y + dy),
        },
      },
    }));

  const marqueeSelection = (marquee: Extract<Session, { kind: "marquee" }>) => {
    const inside = layersInBox(
      shownLayers,
      boxBetween(marquee.at, marquee.to),
    ).map((layer) => layer.id);
    return [...new Set([...marquee.base, ...inside])];
  };

  /** Ends whatever is under way: kept, or put back as it was. */
  const finish = (keep: boolean) => {
    const current = sessionRef.current;
    restoreTransforms();
    setSession(null);
    if (!keep || !current) return;
    switch (current.kind) {
      case "move":
      case "nudge":
        if (current.dx !== 0 || current.dy !== 0)
          apply(moveOperations(current.start, current.dx, current.dy));
        return;
      case "resize": {
        const { frame } = current;
        const before = current.start.frame;
        const next = {
          x: round(frame.x),
          y: round(frame.y),
          width: round(frame.width),
          height: round(frame.height),
        };
        if (
          next.x !== before.x ||
          next.y !== before.y ||
          next.width !== before.width ||
          next.height !== before.height
        )
          apply([
            {
              op: "updateLayer",
              ...target,
              layer: current.id,
              set: { frame: next },
            },
          ]);
        return;
      }
      case "rotate":
        if (current.rotation !== current.start.rotation)
          apply([
            {
              op: "updateLayer",
              ...target,
              layer: current.id,
              set: { rotation: current.rotation },
            },
          ]);
        return;
      case "marquee":
        onSelect(marqueeSelection(current));
        return;
      default:
        return;
    }
  };

  /** A text field being typed in keeps its words for the layer it was typed for. */
  const leaveField = () => {
    const active = globalThis.document.activeElement;
    if (active instanceof HTMLElement && isTyping(active)) active.blur();
  };

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!view || event.button === 2) return;
    leaveField();
    const element = event.currentTarget;
    if (event.pointerType === "touch") {
      touches.current.set(event.pointerId, {
        x: event.clientX,
        y: event.clientY,
      });
      if (touches.current.size === 2) {
        // A second finger turns whatever the first began into a pinch.
        finish(false);
        setSession({ kind: "pinch" });
        element.setPointerCapture(event.pointerId);
        return;
      }
    }
    if (sessionRef.current?.kind === "nudge") finish(true);
    if (sessionRef.current) return;
    element.setPointerCapture(event.pointerId);
    const client = { x: event.clientX, y: event.clientY };
    if (event.button === 1 || spaceHeld.current) {
      event.preventDefault();
      setSession({ kind: "pan", pointerId: event.pointerId, client });
      return;
    }
    if (event.button !== 0) return;
    const at = toFace(event.clientX, event.clientY);
    const hit = hitLayer(shownLayers, at, { tolerance: HIT_PX / view.scale });
    const additive = event.shiftKey;
    let layer: string | null = null;
    let narrow = false;
    if (hit) {
      const chosen = selection.includes(hit.id);
      if (additive) {
        onSelect(
          chosen
            ? selection.filter((id) => id !== hit.id)
            : [...selection, hit.id],
        );
        layer = chosen ? null : hit.id;
      } else {
        if (!chosen) onSelect([hit.id]);
        layer = hit.id;
        narrow = chosen && selection.length > 1;
      }
    } else if (!additive && selection.length > 0) {
      onSelect([]);
    }
    setSession({
      kind: "press",
      pointerId: event.pointerId,
      client,
      at,
      layer,
      narrow,
      additive,
    });
  };

  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!view) return;
    const current = sessionRef.current;
    if (event.pointerType === "touch" && touches.current.has(event.pointerId)) {
      const before = new Map(touches.current);
      touches.current.set(event.pointerId, {
        x: event.clientX,
        y: event.clientY,
      });
      if (current?.kind === "pinch" && touches.current.size === 2) {
        pinch(before, touches.current);
        return;
      }
    }
    if (!current || current.kind === "nudge" || current.kind === "pinch") {
      if (event.pointerType === "mouse" && !current) hover(event);
      return;
    }
    if (current.pointerId !== event.pointerId) return;
    const at = toFace(event.clientX, event.clientY);
    switch (current.kind) {
      case "press": {
        const distance = Math.hypot(
          event.clientX - current.client.x,
          event.clientY - current.client.y,
        );
        if (distance < DRAG_PX) return;
        if (current.layer) {
          const ids = movable(
            current.additive || selection.includes(current.layer)
              ? selection
              : [current.layer],
          );
          if (ids.length === 0) return;
          onHover(null);
          setSession({
            kind: "move",
            pointerId: current.pointerId,
            at: current.at,
            start: placementsOf(ids),
            dx: 0,
            dy: 0,
            guides: NO_GUIDES,
          });
        } else {
          setSession({
            kind: "marquee",
            pointerId: current.pointerId,
            at: current.at,
            to: at,
            base: current.additive ? selection : [],
          });
        }
        return;
      }
      case "move": {
        let dx = at.x - current.at.x;
        let dy = at.y - current.at.y;
        // Shift keeps the move along one axis.
        const along = event.shiftKey
          ? Math.abs(dx) >= Math.abs(dy)
            ? "x"
            : "y"
          : null;
        if (along === "x") dy = 0;
        if (along === "y") dx = 0;
        let guides: readonly SnapGuide[] = NO_GUIDES;
        const ids = [...current.start.keys()];
        const bounds = unionBounds(
          [...current.start.values()].map((placement) =>
            placementBounds(shifted(placement, dx, dy)),
          ),
        );
        if (bounds && !event.altKey) {
          const all = ["start", "center", "end"] as const;
          const snapped = snapBox({
            box: bounds,
            mode: "move",
            lines: {
              x: along === "y" ? [] : all,
              y: along === "x" ? [] : all,
            },
            face: snapFace,
            others: othersThan(ids),
            threshold: SNAP_PX / view.scale,
          });
          dx += snapped.offset.x;
          dy += snapped.offset.y;
          guides = snapped.guides;
        }
        showTransforms(
          new Map(
            [...current.start].map(([id, placement]) => [
              id,
              transformOf(shifted(placement, dx, dy)),
            ]),
          ),
        );
        setSession({ ...current, dx, dy, guides });
        return;
      }
      case "resize": {
        const options = {
          frame: current.start.frame,
          rotation: current.start.rotation,
          handle: current.handle,
          pointer: at,
          keepRatio: event.shiftKey,
        };
        const result = event.altKey
          ? { frame: resizeFrame(options), guides: NO_GUIDES }
          : snapResize({
              ...options,
              face: snapFace,
              others: othersThan([current.id]),
              threshold: SNAP_PX / view.scale,
            });
        setSession({ ...current, frame: result.frame, guides: result.guides });
        return;
      }
      case "rotate": {
        const rotation = rotateTo({
          centre: frameCentre(current.start.frame),
          start: current.start.rotation,
          from: current.from,
          to: at,
          step: event.shiftKey ? 15 : undefined,
        });
        showTransforms(
          new Map([
            [current.id, transformOf({ frame: current.start.frame, rotation })],
          ]),
        );
        setSession({ ...current, rotation });
        return;
      }
      case "marquee":
        setSession({ ...current, to: at });
        return;
      case "pan":
        viewport.panBy(
          event.clientX - current.client.x,
          event.clientY - current.client.y,
        );
        setSession({
          ...current,
          client: { x: event.clientX, y: event.clientY },
        });
        return;
    }
  };

  const pinch = (
    before: ReadonlyMap<number, Point>,
    after: ReadonlyMap<number, Point>,
  ) => {
    const rect = stage.current?.getBoundingClientRect();
    const [a0, b0] = [...before.values()];
    const [a1, b1] = [...after.values()];
    if (!rect || !a0 || !b0 || !a1 || !b1) return;
    const middle = (a: Point, b: Point) => ({
      x: (a.x + b.x) / 2 - rect.left,
      y: (a.y + b.y) / 2 - rect.top,
    });
    const spread0 = Math.hypot(a0.x - b0.x, a0.y - b0.y);
    const spread1 = Math.hypot(a1.x - b1.x, a1.y - b1.y);
    const from = middle(a0, b0);
    const to = middle(a1, b1);
    viewport.panBy(to.x - from.x, to.y - from.y);
    if (spread0 > 0) viewport.zoomBy(spread1 / spread0, to);
  };

  const onPointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    touches.current.delete(event.pointerId);
    const current = sessionRef.current;
    if (!current || current.kind === "nudge") return;
    if (current.kind === "pinch") {
      if (touches.current.size === 0) setSession(null);
      return;
    }
    if (current.pointerId !== event.pointerId) return;
    if (current.kind === "press") {
      setSession(null);
      if (current.narrow && current.layer) onSelect([current.layer]);
      return;
    }
    finish(true);
  };

  const onPointerCancel = (event: ReactPointerEvent<HTMLDivElement>) => {
    touches.current.delete(event.pointerId);
    const current = sessionRef.current;
    if (current && current.kind !== "nudge") finish(false);
  };

  // A pointer that slips away without letting go puts things back.
  const onLostPointerCapture = (event: ReactPointerEvent<HTMLDivElement>) => {
    const current = sessionRef.current;
    if (
      current &&
      "pointerId" in current &&
      current.pointerId === event.pointerId
    )
      finish(false);
  };

  const hover = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!view || spaceHeld.current) return;
    const hit = hitLayer(shownLayers, toFace(event.clientX, event.clientY), {
      tolerance: HIT_PX / view.scale,
    });
    const id = hit?.id ?? null;
    if (id !== hovered) onHover(id);
  };

  const onHandleDown = (
    handle: Handle | "rotate",
    event: ReactPointerEvent<SVGElement>,
  ) => {
    if (event.button !== 0 || !view) return;
    event.stopPropagation();
    leaveField();
    if (sessionRef.current?.kind === "nudge") finish(true);
    const id = selection[0];
    const layer = id ? layerById(id) : undefined;
    if (!layer || layer.locked) return;
    stage.current?.setPointerCapture(event.pointerId);
    const start = { frame: layer.frame, rotation: layer.rotation };
    onHover(null);
    if (handle === "rotate")
      setSession({
        kind: "rotate",
        pointerId: event.pointerId,
        id: layer.id,
        start,
        from: toFace(event.clientX, event.clientY),
        rotation: layer.rotation,
      });
    else
      setSession({
        kind: "resize",
        pointerId: event.pointerId,
        id: layer.id,
        handle,
        start,
        frame: layer.frame,
        guides: NO_GUIDES,
      });
  };

  const onDoubleClick = (event: ReactMouseEvent<HTMLDivElement>) => {
    if (!view) return;
    const hit = hitLayer(shownLayers, toFace(event.clientX, event.clientY), {
      tolerance: HIT_PX / view.scale,
    });
    if (hit?.type === "text") onEditText(hit.id);
  };

  // Keys and wheels act on the latest state through this.
  const latest = useRef({
    selection,
    shownLayers,
    document,
    target,
    apply,
    onSelect,
    finish,
    movable,
    placementsOf,
    showTransforms,
  });
  useLayoutEffect(() => {
    latest.current = {
      selection,
      shownLayers,
      document,
      target,
      apply,
      onSelect,
      finish,
      movable,
      placementsOf,
      showTransforms,
    };
  });

  const { zoomBy, panBy, step, fitToStage, actualSize } = viewport;
  useEffect(() => {
    const element = stage.current;
    if (!element) return;
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      const unit =
        event.deltaMode === 1
          ? 16
          : event.deltaMode === 2
            ? element.clientHeight
            : 1;
      const dx = event.deltaX * unit;
      const dy = event.deltaY * unit;
      if (event.ctrlKey || event.metaKey) {
        // A pinch on a trackpad comes as a wheel with Ctrl held.
        const rect = element.getBoundingClientRect();
        const by = Math.max(-50, Math.min(50, dy));
        zoomBy(Math.exp(-by * 0.008), {
          x: event.clientX - rect.left,
          y: event.clientY - rect.top,
        });
      } else if (event.shiftKey && dx === 0) panBy(-dy, 0);
      else panBy(-dx, -dy);
    };
    // Safari pinches with gestures of its own.
    let gestureScale = 1;
    const onGestureStart = (event: Event) => {
      event.preventDefault();
      gestureScale = 1;
    };
    const onGestureChange = (event: Event) => {
      event.preventDefault();
      const gesture = event as Event & {
        scale: number;
        clientX: number;
        clientY: number;
      };
      const rect = element.getBoundingClientRect();
      zoomBy(gesture.scale / gestureScale, {
        x: gesture.clientX - rect.left,
        y: gesture.clientY - rect.top,
      });
      gestureScale = gesture.scale;
    };
    element.addEventListener("wheel", onWheel, { passive: false });
    element.addEventListener("gesturestart", onGestureStart);
    element.addEventListener("gesturechange", onGestureChange);
    return () => {
      element.removeEventListener("wheel", onWheel);
      element.removeEventListener("gesturestart", onGestureStart);
      element.removeEventListener("gesturechange", onGestureChange);
    };
  }, [zoomBy, panBy]);

  useEffect(() => {
    const arrows: Record<string, [number, number]> = {
      ArrowLeft: [-1, 0],
      ArrowRight: [1, 0],
      ArrowUp: [0, -1],
      ArrowDown: [0, 1],
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (!isShortcut(event)) return;
      const now = latest.current;
      const modifier = isModifier(event);
      const key = event.key.toLowerCase();
      if (event.key === " ") {
        event.preventDefault();
        if (!spaceHeld.current) {
          spaceHeld.current = true;
          setPanReady(true);
        }
        return;
      }
      if (event.key === "Escape") {
        if (sessionRef.current) now.finish(false);
        else if (now.selection.length > 0) now.onSelect([]);
        return;
      }
      if (sessionRef.current && sessionRef.current.kind !== "nudge") return;
      const direction = arrows[event.key];
      if (direction && !modifier && !event.altKey) {
        const current = sessionRef.current;
        const start =
          current?.kind === "nudge"
            ? current.start
            : now.placementsOf(now.movable(now.selection));
        if (start.size === 0) return;
        event.preventDefault();
        const by = event.shiftKey ? NUDGE_MM * 10 : NUDGE_MM;
        const dx =
          (current?.kind === "nudge" ? current.dx : 0) + direction[0] * by;
        const dy =
          (current?.kind === "nudge" ? current.dy : 0) + direction[1] * by;
        now.showTransforms(
          new Map(
            [...start].map(([id, placement]) => [
              id,
              transformOf(shifted(placement, dx, dy)),
            ]),
          ),
        );
        setSession({ kind: "nudge", start, dx, dy });
        return;
      }
      if (sessionRef.current?.kind === "nudge") now.finish(true);
      if (event.key === "Delete" || event.key === "Backspace") {
        const ids = now.movable(now.selection);
        if (ids.length === 0) return;
        event.preventDefault();
        now.apply(
          ids.map((id) => ({ op: "removeLayer", ...now.target, layer: id })),
        );
        now.onSelect([]);
      } else if (modifier && key === "d" && !event.altKey) {
        event.preventDefault();
        if (now.selection.length === 0) return;
        const copies = duplicateLayers(
          now.document,
          now.target,
          now.selection,
          COPY_OFFSET_MM,
        );
        now.apply(copies.operations);
        now.onSelect(copies.ids);
      } else if (modifier && key === "a" && !event.altKey) {
        event.preventDefault();
        now.onSelect(
          now.shownLayers
            .filter((layer) => !layer.hidden && !layer.locked)
            .map((layer) => layer.id),
        );
      } else if (modifier && (key === "=" || key === "+")) {
        event.preventDefault();
        step(1);
      } else if (modifier && key === "-") {
        event.preventDefault();
        step(-1);
      } else if (modifier && key === "0") {
        event.preventDefault();
        actualSize();
      } else if (event.shiftKey && !modifier && event.code === "Digit1") {
        event.preventDefault();
        fitToStage();
      } else if (event.shiftKey && !modifier && event.code === "Digit0") {
        event.preventDefault();
        actualSize();
      }
    };
    const onKeyUp = (event: KeyboardEvent) => {
      if (event.key === " ") {
        spaceHeld.current = false;
        setPanReady(false);
      }
      if (arrows[event.key] && sessionRef.current?.kind === "nudge")
        latest.current.finish(true);
    };
    // Leaving the window lets go of everything held.
    const onBlur = () => {
      spaceHeld.current = false;
      setPanReady(false);
      if (sessionRef.current?.kind === "nudge") latest.current.finish(true);
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", onBlur);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", onBlur);
    };
  }, [step, fitToStage, actualSize]);

  // Another face, or the canvas going away, ends what was under way.
  useEffect(
    () => () => {
      if (sessionRef.current?.kind === "nudge") latest.current.finish(true);
    },
    [],
  );

  // What the overlay draws: the layers as they're placed this moment.
  const placementNow = (layer: Layer): Placement => {
    const placement = { frame: layer.frame, rotation: layer.rotation };
    if (!session) return placement;
    switch (session.kind) {
      case "move":
      case "nudge": {
        const start = session.start.get(layer.id);
        return start ? shifted(start, session.dx, session.dy) : placement;
      }
      case "rotate":
        return session.id === layer.id
          ? { frame: session.start.frame, rotation: session.rotation }
          : placement;
      default:
        return placement;
    }
  };
  const selectedLayers = selection.flatMap((id) => {
    const layer = layerById(id);
    return layer ? [layer] : [];
  });
  const outlines: Outline[] = selectedLayers.map((layer) => ({
    id: layer.id,
    placement: placementNow(layer),
    locked: layer.locked,
    hidden: layer.hidden,
  }));
  const single = selectedLayers.length === 1 ? selectedLayers[0] : undefined;
  const editable =
    single && !single.locked && !single.hidden ? placementNow(single) : null;
  const hoveredLayer =
    hovered && !selection.includes(hovered) && !session
      ? layerById(hovered)
      : undefined;
  const marked =
    session?.kind === "marquee"
      ? layersInBox(shownLayers, boxBetween(session.at, session.to))
          .filter((layer) => !session.base.includes(layer.id))
          .map((layer) => ({ frame: layer.frame, rotation: layer.rotation }))
      : [];

  const locale = useCurrentLocale();
  const number = (value: number, decimals = 1) =>
    value.toLocaleString(locale === "ro" ? "ro-RO" : "en-GB", {
      maximumFractionDigits: decimals,
    });
  const readout =
    session?.kind === "resize"
      ? t("expert.canvas.size", {
          width: number(session.frame.width),
          height: number(session.frame.height),
        })
      : session?.kind === "rotate"
        ? `${number(session.rotation)}°`
        : session?.kind === "move" && outlines[0] && outlines.length === 1
          ? t("expert.canvas.position", {
              x: number(outlines[0].placement.frame.x),
              y: number(outlines[0].placement.frame.y),
            })
          : null;

  const zoom = view ? Math.round((view.scale / PX_PER_MM) * 100) : 100;
  const cursor =
    session?.kind === "pan"
      ? "cursor-grabbing"
      : panReady
        ? "cursor-grab"
        : session?.kind === "rotate"
          ? "cursor-grabbing"
          : session?.kind === "move"
            ? "cursor-move"
            : "cursor-default";

  return (
    <div
      ref={stage}
      role="application"
      aria-label={t("expert.canvas.label", { face: title })}
      aria-roledescription={t("expert.canvas.role")}
      className={cn(
        "relative min-h-0 flex-1 touch-none overflow-hidden select-none",
        cursor,
      )}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
      onLostPointerCapture={onLostPointerCapture}
      onPointerLeave={() => {
        if (!sessionRef.current && hovered) onHover(null);
      }}
      onDoubleClick={onDoubleClick}
      onContextMenu={(event) => event.preventDefault()}
    >
      {view ? (
        <>
          <div
            ref={paper}
            className={cn(
              "pointer-events-none absolute top-0 left-0 origin-top-left",
              guides
                ? "shadow-[0_18px_40px_rgba(43,38,32,0.16)]"
                : "drop-shadow-[0_18px_30px_rgba(43,38,32,0.14)]",
            )}
            style={{
              width: (piece.width + 2 * bleed) * view.scale,
              height: (piece.height + 2 * bleed) * view.scale,
              transform: `translate(${view.x - bleed * view.scale}px, ${view.y - bleed * view.scale}px)`,
            }}
          >
            <Face
              document={shown}
              piece={piece.id}
              face={face}
              context={context}
              guides={guides}
              title={title}
              className="size-full"
            />
          </div>
          <Overlay
            view={view}
            selected={outlines}
            marked={marked}
            hovered={
              hoveredLayer
                ? { frame: hoveredLayer.frame, rotation: hoveredLayer.rotation }
                : null
            }
            editable={session?.kind === "marquee" ? null : editable}
            guides={
              session?.kind === "move" || session?.kind === "resize"
                ? session.guides
                : NO_GUIDES
            }
            marquee={
              session?.kind === "marquee"
                ? boxBetween(session.at, session.to)
                : null
            }
            readout={readout}
            onHandleDown={onHandleDown}
          />
        </>
      ) : null}
      <div
        className="absolute right-3 bottom-3 flex items-center gap-0.5 rounded-full border border-border/70 bg-card/95 p-0.5 shadow-sm backdrop-blur"
        onPointerDown={(event) => event.stopPropagation()}
      >
        <Tooltip label={t("expert.zoom.out")} shortcut={shortcut("-")}>
          <button
            type="button"
            onClick={() => step(-1)}
            aria-label={t("expert.zoom.out")}
            className="flex size-7 items-center justify-center rounded-full text-muted-foreground outline-none hover:bg-secondary hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50"
          >
            <Minus className="size-3.5" aria-hidden />
          </button>
        </Tooltip>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              aria-label={t("expert.zoom.label", { zoom })}
              className="h-7 min-w-14 rounded-full px-2 text-[12px] font-medium tabular-nums outline-none hover:bg-secondary focus-visible:ring-2 focus-visible:ring-ring/50"
            >
              {zoom} %
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" side="top">
            <DropdownMenuItem onSelect={() => fitToStage()}>
              {t("expert.zoom.fit")}
              <Kbd>{shortcut("1", { shift: true, modifier: false })}</Kbd>
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => actualSize()}>
              {t("expert.zoom.actual")}
              <Kbd>{shortcut("0", { shift: true, modifier: false })}</Kbd>
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => step(1)}>
              {t("expert.zoom.in")}
              <Kbd>{shortcut("+")}</Kbd>
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => step(-1)}>
              {t("expert.zoom.out")}
              <Kbd>{shortcut("-")}</Kbd>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <Tooltip label={t("expert.zoom.in")} shortcut={shortcut("+")}>
          <button
            type="button"
            onClick={() => step(1)}
            aria-label={t("expert.zoom.in")}
            className="flex size-7 items-center justify-center rounded-full text-muted-foreground outline-none hover:bg-secondary hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50"
          >
            <Plus className="size-3.5" aria-hidden />
          </button>
        </Tooltip>
      </div>
    </div>
  );
}

function Kbd({ children }: { children: string }) {
  return (
    <kbd className="ml-auto pl-4 font-sans text-[11px] text-muted-foreground">
      {children}
    </kbd>
  );
}
