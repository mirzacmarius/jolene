"use client";

import {
  type Camera,
  cameraTransform,
  clampCamera,
  fittedCamera,
  panCamera,
  type Size,
  zoomCamera,
} from "@jolene/design/react";
import {
  type RefObject,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";

/** How long the camera rests before the preview is drawn afresh, sharp. */
const SETTLE_MS = 180;
/** How long a zoom by button or double click glides. */
const GLIDE_MS = 300;
/** How far a double click or double tap zooms in. */
const DOUBLE_TAP_ZOOM = 2.5;

interface Point {
  x: number;
  y: number;
}

const middle = (a: Point, b: Point): Point => ({
  x: (a.x + b.x) / 2,
  y: (a.y + b.y) / 2,
});

/** Safari's pinch on a trackpad, which it sends instead of a wheel. */
type GestureEvent = Event & { scale: number; clientX: number; clientY: number };

/**
 * Zoom and pan over a preview. Ctrl or Cmd with the wheel, or a trackpad's
 * pinch, zooms about the pointer; two fingers pinch; once zoomed in, a drag
 * or the wheel moves about; a double click or double tap zooms in, and back.
 *
 * While it moves, the camera transforms the `table` element directly, frame
 * by frame, as a picture of itself: nothing renders. Once it rests it returns
 * the zoom it settled at, for the preview to draw itself afresh at that size.
 */
export function useCamera({
  stage,
  table,
  size,
  most,
  anchor,
  still,
}: {
  /** Takes the gestures. */
  stage: RefObject<HTMLElement | null>;
  /** Moves with the camera: the table and all that lies on it. */
  table: RefObject<HTMLElement | null>;
  /** The stage's size, once measured. */
  size: Size | null;
  /** The most it may zoom in. */
  most: number;
  /** What the buttons zoom about, in stage pixels: the middle of the view. */
  anchor: Point;
  /** For visitors who ask for less motion: zooms jump instead of gliding. */
  still: boolean;
}) {
  const [zoom, setZoom] = useState(1);
  const camera = useRef<Camera>(fittedCamera);
  const latest = useRef({ size, most, anchor, still });
  useLayoutEffect(() => {
    latest.current = { size, most, anchor, still };
  });
  /** True while fingers or a mouse hold the camera. */
  const holding = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  /** Shows the stage through `next`, gliding there or at once. */
  const move = useCallback(
    (next: Camera, glide = false) => {
      const element = table.current;
      const { size, most, still } = latest.current;
      if (!element || !size) return;
      const glides = glide && !still;
      const clamped = clampCamera(next, size, most);
      camera.current = clamped.zoom < 1.01 ? fittedCamera : clamped;
      // Scaled as a picture of itself while it moves (a layer of its own),
      // and drawn afresh once it rests.
      element.style.willChange = "transform";
      element.style.transition = glides
        ? `transform ${GLIDE_MS}ms cubic-bezier(0.2, 0.7, 0.2, 1)`
        : "";
      element.style.transform = cameraTransform(camera.current);
      clearTimeout(timer.current);
      if (holding.current) return;
      timer.current = setTimeout(
        () => {
          element.style.willChange = "";
          element.style.transition = "";
          setZoom(camera.current.zoom);
        },
        glides ? GLIDE_MS + 20 : SETTLE_MS,
      );
    },
    [table],
  );

  useEffect(() => {
    const element = stage.current;
    if (!element) return;
    const pointers = new Map<number, Point>();
    let pinch: { camera: Camera; distance: number; middle: Point } | null =
      null;
    let drag: { camera: Camera; from: Point } | null = null;
    /** The touch now down, to tell a tap from a drag. */
    let touch: { time: number; at: Point; moved: boolean } | null = null;
    let lastTap: { time: number; at: Point } | null = null;
    let lastPointer = "mouse";
    /** Where Safari's pinch started. */
    let gesture: Camera | null = null;
    /** Whether the fingers or mouse now holding the camera have moved it. */
    let moved = false;

    const local = (event: { clientX: number; clientY: number }): Point => {
      const rect = element.getBoundingClientRect();
      return { x: event.clientX - rect.left, y: event.clientY - rect.top };
    };
    const zoomed = () => camera.current.zoom > 1;
    const toggle = (at: Point) => {
      const { size, most } = latest.current;
      if (!size) return;
      move(
        zoomed()
          ? fittedCamera
          : zoomCamera(fittedCamera, DOUBLE_TAP_ZOOM, at, size, most),
        true,
      );
    };
    const startPinch = () => {
      const [a, b] = [...pointers.values()];
      if (!a || !b) return;
      pinch = {
        camera: camera.current,
        distance: Math.max(1, Math.hypot(a.x - b.x, a.y - b.y)),
        middle: middle(a, b),
      };
      drag = null;
      holding.current = true;
    };
    const startDrag = (at: Point) => {
      drag = zoomed() ? { camera: camera.current, from: at } : null;
      holding.current = drag !== null;
    };

    const onDown = (event: PointerEvent) => {
      lastPointer = event.pointerType;
      if (event.pointerType === "mouse" && event.button !== 0) return;
      const at = local(event);
      pointers.set(event.pointerId, at);
      if (pointers.size === 2) startPinch();
      if (pointers.size !== 1) return;
      startDrag(at);
      touch =
        event.pointerType === "touch"
          ? { time: event.timeStamp, at, moved: false }
          : null;
      if (drag && event.pointerType !== "touch") {
        element.setPointerCapture(event.pointerId);
        element.style.cursor = "grabbing";
      }
    };

    const onMove = (event: PointerEvent) => {
      if (!pointers.has(event.pointerId)) return;
      const at = local(event);
      pointers.set(event.pointerId, at);
      if (touch && Math.hypot(at.x - touch.at.x, at.y - touch.at.y) > 10)
        touch.moved = true;
      const { size, most } = latest.current;
      if (!size) return;
      const [a, b] = [...pointers.values()];
      if (pinch && a && b) {
        const now = middle(a, b);
        const scaled = zoomCamera(
          pinch.camera,
          Math.hypot(a.x - b.x, a.y - b.y) / pinch.distance,
          pinch.middle,
          size,
          most,
        );
        moved = true;
        move(
          panCamera(
            scaled,
            now.x - pinch.middle.x,
            now.y - pinch.middle.y,
            size,
            most,
          ),
        );
      } else if (drag) {
        moved = true;
        move(
          panCamera(
            drag.camera,
            at.x - drag.from.x,
            at.y - drag.from.y,
            size,
            most,
          ),
        );
      }
    };

    const onUp = (event: PointerEvent) => {
      if (!pointers.delete(event.pointerId)) return;
      if (pointers.size < 2) pinch = null;
      const [left] = [...pointers.values()];
      if (left) {
        // One finger stays after a pinch: it drags on from here.
        startDrag(left);
        return;
      }
      drag = null;
      element.style.cursor = "";
      if (
        event.type === "pointerup" &&
        touch &&
        !touch.moved &&
        event.timeStamp - touch.time < 300
      ) {
        const { at } = touch;
        if (
          lastTap &&
          event.timeStamp - lastTap.time < 350 &&
          Math.hypot(at.x - lastTap.at.x, at.y - lastTap.at.y) < 40
        ) {
          lastTap = null;
          touch = null;
          holding.current = false;
          moved = false;
          toggle(at);
          return;
        }
        lastTap = { time: event.timeStamp, at };
      }
      touch = null;
      holding.current = false;
      // Let go: once it rests, it's drawn afresh.
      if (moved) move(camera.current);
      moved = false;
    };

    const onWheel = (event: WheelEvent) => {
      const { size, most } = latest.current;
      if (!size) return;
      const unit =
        event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? size.height : 1;
      if (event.ctrlKey || event.metaKey) {
        event.preventDefault();
        const delta = Math.max(-50, Math.min(50, event.deltaY * unit));
        move(
          zoomCamera(
            camera.current,
            Math.exp(-delta * 0.01),
            local(event),
            size,
            most,
          ),
        );
      } else if (zoomed()) {
        event.preventDefault();
        move(
          panCamera(
            camera.current,
            -event.deltaX * unit,
            -event.deltaY * unit,
            size,
            most,
          ),
        );
      }
    };

    const onDoubleClick = (event: MouseEvent) => {
      // A double tap is told apart by its pointers, above.
      if (lastPointer !== "touch") toggle(local(event));
    };

    // Safari pinches a trackpad with gesture events; on a phone it sends them
    // as well as the pointers, which are handled already.
    const onGestureStart = (event: Event) => {
      if (pointers.size > 0) return;
      event.preventDefault();
      gesture = camera.current;
    };
    const onGestureChange = (event: Event) => {
      const { size, most } = latest.current;
      if (!gesture || !size) return;
      event.preventDefault();
      const { scale, clientX, clientY } = event as GestureEvent;
      move(zoomCamera(gesture, scale, local({ clientX, clientY }), size, most));
    };
    const onGestureEnd = (event: Event) => {
      if (!gesture) return;
      event.preventDefault();
      gesture = null;
    };

    element.addEventListener("pointerdown", onDown);
    element.addEventListener("pointermove", onMove);
    element.addEventListener("pointerup", onUp);
    element.addEventListener("pointercancel", onUp);
    element.addEventListener("wheel", onWheel, { passive: false });
    element.addEventListener("dblclick", onDoubleClick);
    element.addEventListener("gesturestart", onGestureStart);
    element.addEventListener("gesturechange", onGestureChange);
    element.addEventListener("gestureend", onGestureEnd);
    return () => {
      element.removeEventListener("pointerdown", onDown);
      element.removeEventListener("pointermove", onMove);
      element.removeEventListener("pointerup", onUp);
      element.removeEventListener("pointercancel", onUp);
      element.removeEventListener("wheel", onWheel);
      element.removeEventListener("dblclick", onDoubleClick);
      element.removeEventListener("gesturestart", onGestureStart);
      element.removeEventListener("gesturechange", onGestureChange);
      element.removeEventListener("gestureend", onGestureEnd);
      clearTimeout(timer.current);
    };
  }, [stage, move]);

  // A resized stage may leave the camera past the table's edge.
  const width = size?.width;
  const height = size?.height;
  useEffect(() => {
    if (width && height && camera.current !== fittedCamera)
      move(camera.current);
  }, [width, height, move]);

  const zoomBy = useCallback(
    (factor: number) => {
      const { size, most, anchor } = latest.current;
      if (size)
        move(zoomCamera(camera.current, factor, anchor, size, most), true);
    },
    [move],
  );
  /** Back to the whole item: gliding for a button, at once for a new view. */
  const showAll = useCallback(
    (glide = true) => {
      if (camera.current !== fittedCamera) move(fittedCamera, glide);
    },
    [move],
  );

  return { zoom, zoomBy, showAll };
}
