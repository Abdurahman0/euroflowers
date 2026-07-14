"use client";
import { useEffect } from "react";

/**
 * Kinematik DOM parallaks dvigateli — kursor holatini rAF'da silliqlab,
 * ildizga --plx-x / --plx-y (piksel) o'zgaruvchilarini yozadi.
 * Qatlamlar o'z chuqurligini ko'paytiradi:
 *   transform: translate3d(calc(var(--plx-x) * 5), calc(var(--plx-y) * 5), 0)
 * Maksimal siljish: 8px (chuqurlik 8 bo'lganda). Juda nafis.
 * prefers-reduced-motion'da butunlay o'chadi.
 */
export default function ParallaxController() {
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const root = document.documentElement;
    let tx = 0, ty = 0, cx = 0, cy = 0;
    let raf = 0;
    let last = performance.now();

    const onMove = (e: PointerEvent) => {
      tx = (e.clientX / window.innerWidth) * 2 - 1;
      ty = (e.clientY / window.innerHeight) * 2 - 1;
    };

    const loop = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      const k = 1 - Math.exp(-dt * 3.2);
      cx += (tx - cx) * k;
      cy += (ty - cy) * k;
      root.style.setProperty("--plx-x", `${(cx).toFixed(4)}px`);
      root.style.setProperty("--plx-y", `${(cy).toFixed(4)}px`);
      raf = requestAnimationFrame(loop);
    };

    window.addEventListener("pointermove", onMove, { passive: true });
    raf = requestAnimationFrame(loop);
    return () => {
      window.removeEventListener("pointermove", onMove);
      cancelAnimationFrame(raf);
      root.style.removeProperty("--plx-x");
      root.style.removeProperty("--plx-y");
    };
  }, []);
  return null;
}
