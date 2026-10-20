"use client";

import { moveLight } from "@jolene/design/react";
import { type RefObject, useEffect, useLayoutEffect, useRef } from "react";

/** How far the item leans towards the pointer at its edge, in degrees. */
const LEAN_DEG = 2.5;
/** How far the eye is from the item, for the lean's perspective. */
const PERSPECTIVE_PX = 1600;
/**
 * How quickly the light and the lean catch up with the pointer: in this many
 * milliseconds they close about two thirds of the way.
 */
const FOLLOW_MS = 90;
/** How quickly they glide on the light's sweep, below. */
const SWEEP_MS = 260;
/**
 * The light passing once over a view as it appears, so foil and gloss show
 * themselves before the pointer moves: when, in milliseconds, and where.
 */
const SWEEP: [number, number, number][] = [
  [120, -0.8, -0.55],
  [700, 0.7, 0.45],
  [1300, 0, 0],
];

const clamp = (value: number) => Math.max(-1, Math.min(1, value));

interface Point {
  x: number;
  y: number;
}

/**
 * The light follows the pointer over the stage, and the item leans gently
 * towards a mouse or pen. Both ease towards the pointer frame by frame and
 * are set on their elements directly, without rendering: the light on the
 * views' light layers alone (moveLight), the lean as the transform of `tilt`,
 * which a layer of its own turns cheaply.
 */
export function useLight({
  stage,
  item,
  tilt,
  follow,
  lean,
  sweep,
}: {
  /** Where the pointer is followed. */
  stage: RefObject<HTMLElement | null>;
  /** Holds the lifelike view; the light is placed over its box. */
  item: RefObject<HTMLElement | null>;
  /** Leans towards the pointer. */
  tilt: RefObject<HTMLElement | null>;
  /** Whether the light follows the pointer. */
  follow: boolean;
  /** Whether the item leans towards a mouse or pen. */
  lean: boolean;
  /** Passes the light over the view each time this changes. */
  sweep: string;
}) {
  const latest = useRef({ follow, lean });
  useLayoutEffect(() => {
    latest.current = { follow, lean };
  });
  const motion = useRef({
    /** Where the light is, and where it's heading. */
    light: { x: 0, y: 0 } as Point,
    target: { x: 0, y: 0 } as Point,
    /** How far the item leans, as a point like the light's. */
    leaning: { x: 0, y: 0 } as Point,
    /** The pointer, in the page, while it's over the stage. */
    pointer: null as Point | null,
    /** Whether that pointer leans the item: a mouse or pen, not a finger. */
    leans: false,
    pace: FOLLOW_MS,
    frame: 0,
    time: 0,
    /** Set once the pointer moves, which ends a sweep. */
    touched: false,
  });

  /** Eases the light and the lean on towards their targets, one frame. */
  const step = useRef((now: number) => {
    const m = motion.current;
    m.frame = 0;
    const box = item.current;
    if (!box) return;
    if (m.pointer) {
      const rect = box.getBoundingClientRect();
      m.target = {
        x: clamp((m.pointer.x - rect.left) / (rect.width / 2) - 1),
        y: clamp((m.pointer.y - rect.top) / (rect.height / 2) - 1),
      };
    }
    const elapsed = m.time ? Math.min(64, now - m.time) : 16;
    m.time = now;
    const k = 1 - Math.exp(-elapsed / m.pace);
    const { follow, lean } = latest.current;
    const toward = m.pointer && m.leans && lean ? m.target : { x: 0, y: 0 };
    m.light.x += (m.target.x - m.light.x) * k;
    m.light.y += (m.target.y - m.light.y) * k;
    m.leaning.x += (toward.x - m.leaning.x) * k;
    m.leaning.y += (toward.y - m.leaning.y) * k;
    const still =
      Math.abs(m.target.x - m.light.x) < 0.001 &&
      Math.abs(m.target.y - m.light.y) < 0.001 &&
      Math.abs(toward.x - m.leaning.x) < 0.001 &&
      Math.abs(toward.y - m.leaning.y) < 0.001;
    if (still) {
      m.light = { ...m.target };
      m.leaning = { ...toward };
    }
    if (follow) moveLight(box, m.light.x, m.light.y);
    const leaning = tilt.current;
    if (leaning && lean)
      leaning.style.transform =
        m.leaning.x === 0 && m.leaning.y === 0
          ? ""
          : `perspective(${PERSPECTIVE_PX}px) rotateX(${(m.leaning.y * LEAN_DEG).toFixed(3)}deg) rotateY(${(-m.leaning.x * LEAN_DEG).toFixed(3)}deg)`;
    if (still) m.time = 0;
    else m.frame = requestAnimationFrame(step.current);
  });
  const kick = useRef(() => {
    const m = motion.current;
    if (!m.frame) m.frame = requestAnimationFrame(step.current);
  });

  useEffect(() => {
    const element = stage.current;
    if (!element) return;
    const m = motion.current;
    const onMove = (event: PointerEvent) => {
      if (!latest.current.follow) return;
      m.touched = true;
      m.pointer = { x: event.clientX, y: event.clientY };
      m.leans = event.pointerType !== "touch";
      m.pace = FOLLOW_MS;
      kick.current();
    };
    const onLeave = (event: PointerEvent) => {
      // A finger lifted leaves the light where it put it.
      if (event.pointerType === "touch") return;
      m.pointer = null;
      m.target = { x: 0, y: 0 };
      kick.current();
    };
    element.addEventListener("pointermove", onMove);
    element.addEventListener("pointerleave", onLeave);
    return () => {
      element.removeEventListener("pointermove", onMove);
      element.removeEventListener("pointerleave", onLeave);
      cancelAnimationFrame(m.frame);
      m.frame = 0;
    };
  }, [stage]);

  // Leaning stops when the pointer can't lean it (zoomed in, say), and the
  // light rests in the middle when it doesn't follow.
  useEffect(() => {
    if (!lean && tilt.current) {
      tilt.current.style.transform = "";
      motion.current.leaning = { x: 0, y: 0 };
    }
  }, [lean, tilt]);
  useEffect(() => {
    if (follow) return;
    const m = motion.current;
    m.light = { x: 0, y: 0 };
    m.target = { x: 0, y: 0 };
    if (item.current) moveLight(item.current, 0, 0);
  }, [follow, item]);

  // Light layers drawn afresh, for a new zoom, take the light where it was.
  useLayoutEffect(() => {
    const { light } = motion.current;
    if (item.current && latest.current.follow)
      moveLight(item.current, light.x, light.y);
  });

  useEffect(() => {
    if (!follow || !sweep) return;
    const m = motion.current;
    m.touched = false;
    const timers = SWEEP.map(([delay, x, y]) =>
      setTimeout(() => {
        if (m.touched) return;
        m.target = { x, y };
        m.pace = SWEEP_MS;
        kick.current();
      }, delay),
    );
    return () => {
      for (const timer of timers) clearTimeout(timer);
    };
  }, [follow, sweep]);
}
