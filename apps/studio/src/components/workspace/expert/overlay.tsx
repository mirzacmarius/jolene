"use client";

import {
  type Box,
  frameCentre,
  type Handle,
  handlePoint,
  handles,
  type Placement,
  placementCorners,
  rotatePoint,
  type SnapGuide,
} from "@jolene/design";
import type { PointerEvent as ReactPointerEvent } from "react";
import type { Viewport } from "./use-viewport";

/** The editing marks over the canvas: selection, handles, guides. */

const SELECTION = "#2563eb";
const LOCKED = "#64748b";
const SNAP = "#db2777";
/** A handle's square, and the larger area that picks it up, in pixels. */
const HANDLE = 8;
const HANDLE_HIT = 18;
/** How far above the top edge the rotation handle sits, in pixels. */
const ROTATE_OFFSET = 24;

export interface Outline {
  id: string;
  placement: Placement;
  locked: boolean;
  hidden: boolean;
}

const cursors = ["ns-resize", "nesw-resize", "ew-resize", "nwse-resize"];
const handleAngles: Record<Handle, number> = {
  n: 0,
  ne: 45,
  e: 90,
  se: 135,
  s: 180,
  sw: 225,
  w: 270,
  nw: 315,
};

/** The resize cursor that points the way a handle pulls, turned with the layer. */
function cursorFor(handle: Handle, rotation: number) {
  const angle = (((handleAngles[handle] + rotation) % 180) + 180) % 180;
  return cursors[Math.round(angle / 45) % 4];
}

export function Overlay({
  view,
  selected,
  marked,
  hovered,
  editable,
  guides,
  marquee,
  readout,
  onHandleDown,
}: {
  view: Viewport;
  /** The layers selected, as they're placed now. */
  selected: readonly Outline[];
  /** Layers a marquee being drawn would select. */
  marked: readonly Placement[];
  hovered: Placement | null;
  /** The single layer whose handles show. */
  editable: Placement | null;
  guides: readonly SnapGuide[];
  marquee: Box | null;
  /** A measurement shown under the selection while it changes. */
  readout: string | null;
  onHandleDown: (
    handle: Handle | "rotate",
    event: ReactPointerEvent<SVGElement>,
  ) => void;
}) {
  const screen = (point: { x: number; y: number }) => ({
    x: view.x + point.x * view.scale,
    y: view.y + point.y * view.scale,
  });
  const polygon = (placement: Placement) =>
    placementCorners(placement)
      .map((corner) => {
        const { x, y } = screen(corner);
        return `${x},${y}`;
      })
      .join(" ");

  const bounds = selected.length > 0 ? screenBounds(selected, screen) : null;

  return (
    <>
      <svg
        className="pointer-events-none absolute inset-0 size-full overflow-visible"
        aria-hidden
      >
        {hovered ? (
          <polygon
            points={polygon(hovered)}
            fill="none"
            stroke={SELECTION}
            strokeWidth={1}
            strokeOpacity={0.6}
          />
        ) : null}
        {marked.map((placement, index) => (
          <polygon
            // Marked layers only ever come and go with the marquee.
            // biome-ignore lint/suspicious/noArrayIndexKey: see above
            key={index}
            points={polygon(placement)}
            fill="none"
            stroke={SELECTION}
            strokeWidth={1}
          />
        ))}
        {selected.map((outline) => (
          <polygon
            key={outline.id}
            points={polygon(outline.placement)}
            fill="none"
            stroke={outline.locked ? LOCKED : SELECTION}
            strokeWidth={outline.locked || outline.hidden ? 1 : 1.5}
            strokeDasharray={outline.hidden ? "4 3" : undefined}
          />
        ))}
        {selected.length > 1 && bounds ? (
          <rect
            x={bounds.x}
            y={bounds.y}
            width={bounds.width}
            height={bounds.height}
            fill="none"
            stroke={SELECTION}
            strokeWidth={1}
            strokeDasharray="4 3"
          />
        ) : null}
        {guides.map((guide) => {
          const from = screen(
            guide.axis === "x"
              ? { x: guide.at, y: guide.from }
              : { x: guide.from, y: guide.at },
          );
          const to = screen(
            guide.axis === "x"
              ? { x: guide.at, y: guide.to }
              : { x: guide.to, y: guide.at },
          );
          return (
            <line
              key={`${guide.axis}${guide.at}`}
              x1={from.x}
              y1={from.y}
              x2={to.x}
              y2={to.y}
              stroke={SNAP}
              strokeWidth={1}
            />
          );
        })}
        {marquee ? (
          <rect
            {...screenBox(marquee, screen)}
            fill={SELECTION}
            fillOpacity={0.08}
            stroke={SELECTION}
            strokeWidth={1}
          />
        ) : null}
        {editable ? (
          <Handles
            placement={editable}
            scale={view.scale}
            screen={screen}
            onHandleDown={onHandleDown}
          />
        ) : null}
      </svg>
      {readout && bounds ? (
        <div
          className="pointer-events-none absolute -translate-x-1/2 rounded-md bg-[#2563eb] px-1.5 py-0.5 text-[11px] font-medium whitespace-nowrap text-white tabular-nums shadow-sm"
          style={{
            left: bounds.x + bounds.width / 2,
            top: bounds.y + bounds.height + 10,
          }}
        >
          {readout}
        </div>
      ) : null}
    </>
  );
}

function Handles({
  placement,
  scale,
  screen,
  onHandleDown,
}: {
  placement: Placement;
  scale: number;
  screen: (point: { x: number; y: number }) => { x: number; y: number };
  onHandleDown: (
    handle: Handle | "rotate",
    event: ReactPointerEvent<SVGElement>,
  ) => void;
}) {
  const { frame, rotation } = placement;
  const centre = frameCentre(frame);
  const at = (point: { x: number; y: number }) =>
    screen(rotatePoint(point, centre, rotation));
  // A short or narrow layer keeps only the handles that don't sit on each
  // other, and leaves its middle free to drag.
  const short = frame.height * scale < 2 * HANDLE_HIT;
  const narrow = frame.width * scale < 2 * HANDLE_HIT;
  const shown = handles.filter((handle) => {
    if (short && narrow) return handle === "se";
    if (short) return handle === "e" || handle === "w";
    if (narrow) return handle === "n" || handle === "s";
    return true;
  });
  const top = at({ x: centre.x, y: frame.y });
  const knob = at({ x: centre.x, y: frame.y - ROTATE_OFFSET / scale });
  return (
    <g>
      <line
        x1={top.x}
        y1={top.y}
        x2={knob.x}
        y2={knob.y}
        stroke={SELECTION}
        strokeWidth={1}
      />
      <circle
        cx={knob.x}
        cy={knob.y}
        r={HANDLE / 2 + 1}
        fill="#ffffff"
        stroke={SELECTION}
        strokeWidth={1.5}
      />
      <circle
        cx={knob.x}
        cy={knob.y}
        r={HANDLE_HIT / 2}
        fill="transparent"
        className="pointer-events-auto"
        style={{ cursor: "grab" }}
        data-handle="rotate"
        onPointerDown={(event) => onHandleDown("rotate", event)}
      />
      {shown.map((handle) => {
        const point = at(handlePoint(frame, handle));
        const turn = `rotate(${rotation} ${point.x} ${point.y})`;
        return (
          <g key={handle} transform={turn}>
            <rect
              x={point.x - HANDLE / 2}
              y={point.y - HANDLE / 2}
              width={HANDLE}
              height={HANDLE}
              rx={1.5}
              fill="#ffffff"
              stroke={SELECTION}
              strokeWidth={1.5}
            />
            <rect
              x={point.x - HANDLE_HIT / 2}
              y={point.y - HANDLE_HIT / 2}
              width={HANDLE_HIT}
              height={HANDLE_HIT}
              fill="transparent"
              className="pointer-events-auto"
              style={{ cursor: cursorFor(handle, rotation) }}
              data-handle={handle}
              onPointerDown={(event) => onHandleDown(handle, event)}
            />
          </g>
        );
      })}
    </g>
  );
}

function screenBox(
  box: Box,
  screen: (point: { x: number; y: number }) => { x: number; y: number },
) {
  const from = screen({ x: box.x, y: box.y });
  const to = screen({ x: box.x + box.width, y: box.y + box.height });
  return {
    x: Math.min(from.x, to.x),
    y: Math.min(from.y, to.y),
    width: Math.abs(to.x - from.x),
    height: Math.abs(to.y - from.y),
  };
}

/** The upright box around the outlines, in the stage's pixels. */
function screenBounds(
  outlines: readonly Outline[],
  screen: (point: { x: number; y: number }) => { x: number; y: number },
) {
  const points = outlines.flatMap((outline) =>
    placementCorners(outline.placement).map(screen),
  );
  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return { x, y, width: Math.max(...xs) - x, height: Math.max(...ys) - y };
}
