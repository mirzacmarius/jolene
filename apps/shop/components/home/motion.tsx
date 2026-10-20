// Adapted from Marée by LN (MIT License): see THIRD-PARTY-NOTICES.md.
"use client";

import { useEffect } from "react";

const REVEAL_STAGGER_MS = 130;
const SCROLL_SHIFT_PX = 38;
const SCROLL_TURN_DEG = 45;
const TILT_DEG = 3;

function setUpMotion(): () => void {
  const root = document.documentElement;
  const reveals = [...document.querySelectorAll<HTMLElement>("[data-reveal]")];
  const revealObserver = new IntersectionObserver(
    (entries) => {
      for (const { isIntersecting, target } of entries) {
        if (!isIntersecting || !(target instanceof HTMLElement)) continue;
        target.dataset.motion = "in";
        revealObserver.unobserve(target);
      }
    },
    { rootMargin: "0px 0px -32px 0px", threshold: 0.12 },
  );
  for (const node of reveals) {
    // Never hide what is already on screen, such as after a restored scroll.
    if (node.getBoundingClientRect().top < innerHeight * 0.92) continue;
    const siblings = [...(node.parentElement?.children ?? [])].filter((child) =>
      child.hasAttribute("data-reveal"),
    );
    node.style.setProperty(
      "--reveal-delay",
      `${Math.min(siblings.indexOf(node), 3) * REVEAL_STAGGER_MS}ms`,
    );
    node.dataset.motion = "ready";
    revealObserver.observe(node);
  }

  const scenes = [...document.querySelectorAll<HTMLElement>("[data-scene]")];
  const visible = new Set<HTMLElement>();
  let frame = 0;
  const update = () => {
    frame = 0;
    for (const node of visible) {
      const rect = node.getBoundingClientRect();
      const progress = Math.max(
        -1,
        Math.min(
          1,
          (innerHeight / 2 - rect.top - rect.height / 2) / (innerHeight / 2 + rect.height / 2),
        ),
      );
      node.style.setProperty("--scroll-progress", String(progress));
      node.style.setProperty("--scroll-shift", `${progress * SCROLL_SHIFT_PX}px`);
      node.style.setProperty("--scroll-turn", `${progress * SCROLL_TURN_DEG}deg`);
    }
    const available = root.scrollHeight - innerHeight;
    root.style.setProperty("--page-progress", String(available > 0 ? scrollY / available : 0));
  };
  const schedule = () => {
    frame ||= requestAnimationFrame(update);
  };
  const sceneObserver = new IntersectionObserver(
    (entries) => {
      for (const { isIntersecting, target } of entries) {
        if (!(target instanceof HTMLElement)) continue;
        if (isIntersecting) visible.add(target);
        else visible.delete(target);
      }
      schedule();
    },
    { rootMargin: "100px" },
  );
  for (const node of scenes) sceneObserver.observe(node);
  addEventListener("scroll", schedule, { passive: true });
  addEventListener("resize", schedule, { passive: true });
  schedule();

  // Only precise pointers tilt, and only what holds no hit target.
  const fine = matchMedia("(hover: hover) and (pointer: fine)");
  const tilts = [...document.querySelectorAll<HTMLElement>("[data-tilt]")];
  const tilt = (event: PointerEvent) => {
    if (
      !fine.matches ||
      event.pointerType === "touch" ||
      !(event.currentTarget instanceof HTMLElement)
    )
      return;
    const node = event.currentTarget;
    const rect = node.getBoundingClientRect();
    node.style.setProperty(
      "--tilt-x",
      `${((event.clientX - rect.left - rect.width / 2) / rect.width) * TILT_DEG}deg`,
    );
    node.style.setProperty(
      "--tilt-y",
      `${(-(event.clientY - rect.top - rect.height / 2) / rect.height) * TILT_DEG}deg`,
    );
  };
  const untilt = (event: PointerEvent) => {
    if (!(event.currentTarget instanceof HTMLElement)) return;
    event.currentTarget.style.removeProperty("--tilt-x");
    event.currentTarget.style.removeProperty("--tilt-y");
  };
  for (const node of tilts) {
    node.addEventListener("pointermove", tilt);
    node.addEventListener("pointerleave", untilt);
  }

  return () => {
    revealObserver.disconnect();
    sceneObserver.disconnect();
    cancelAnimationFrame(frame);
    removeEventListener("scroll", schedule);
    removeEventListener("resize", schedule);
    root.style.removeProperty("--page-progress");
    for (const node of reveals) {
      delete node.dataset.motion;
      node.style.removeProperty("--reveal-delay");
    }
    for (const node of scenes) {
      for (const property of ["--scroll-progress", "--scroll-shift", "--scroll-turn"]) {
        node.style.removeProperty(property);
      }
    }
    for (const node of tilts) {
      node.removeEventListener("pointermove", tilt);
      node.removeEventListener("pointerleave", untilt);
      node.style.removeProperty("--tilt-x");
      node.style.removeProperty("--tilt-y");
    }
  };
}

// Progressive enhancement: everything is visible until this runs, and nothing moves for reduced motion.
export function HomeMotion() {
  useEffect(() => {
    const reduced = matchMedia("(prefers-reduced-motion: reduce)");
    let dispose = () => {};
    const start = () => {
      dispose();
      dispose = reduced.matches || !("IntersectionObserver" in window) ? () => {} : setUpMotion();
    };
    start();
    reduced.addEventListener("change", start);
    return () => {
      dispose();
      reduced.removeEventListener("change", start);
    };
  }, []);

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-x-0 top-0 z-60 h-0.5 origin-left scale-x-[var(--page-progress,0)] bg-gold motion-reduce:hidden"
    />
  );
}
