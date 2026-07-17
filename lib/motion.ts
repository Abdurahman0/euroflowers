"use client";
import { useEffect, useState } from "react";

/**
 * prefers-reduced-motion kuzatuvchisi — three'siz modul.
 * (Ilgari SceneController'da edi; u @react-three/fiber'ni tortib kelgani
 * uchun DOM-only komponentlar hookni shu yerdan oladi.)
 */
export const usePrefersReducedMotion = () => {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const fn = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener("change", fn);
    return () => mq.removeEventListener("change", fn);
  }, []);
  return reduced;
};
