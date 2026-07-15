"use client";
import { useEffect, useRef } from "react";

/**
 * Sichqoncha parallaksi — element sahifaga "yopishgan" his beradi.
 * Maksimal siljish: 5px. rAF + lerp, re-render yo'q, reduced-motion hurmat qilinadi.
 */
export function useFlowerParallax<T extends HTMLElement>(maxPx = 5) {
  const ref = useRef<T>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let tx = 0, ty = 0, cx = 0, cy = 0;
    let raf = 0;
    const onMove = (e: MouseEvent) => {
      tx = (e.clientX / window.innerWidth - 0.5) * 2 * maxPx;
      ty = (e.clientY / window.innerHeight - 0.5) * 2 * maxPx;
    };
    const loop = () => {
      cx += (tx - cx) * 0.06;
      cy += (ty - cy) * 0.06;
      el.style.transform = `translate3d(${cx.toFixed(2)}px, ${cy.toFixed(2)}px, 0)`;
      raf = requestAnimationFrame(loop);
    };
    window.addEventListener("mousemove", onMove, { passive: true });
    raf = requestAnimationFrame(loop);
    return () => {
      window.removeEventListener("mousemove", onMove);
      cancelAnimationFrame(raf);
    };
  }, [maxPx]);

  return ref;
}
