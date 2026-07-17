"use client";
import { Suspense } from "react";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { useFlowerLoader } from "@/hooks/useFlowerLoader";
import { useFlowerParallax } from "@/components/flowers/useFlowerParallax";
import LoginCanvas from "./LoginCanvas";
import LoadingFallback from "./LoadingFallback";
import "@/styles/login-3d.css";

/**
 * Login qahramon sahnasi — Blender buketi (stol + vaza + piyonlar).
 * DOM parallaks ≤3px + canvas ichida ≤2° rotatsiya: tirik, lekin yopishgan.
 */
export default function LoginScene() {
  const reduced = useReducedMotion();
  const wrapRef = useFlowerParallax<HTMLDivElement>(3);
  useFlowerLoader();

  return (
    <div ref={wrapRef} className="login3d-wrap" aria-hidden>
      <div className="login3d-glow" />
      <Suspense fallback={<LoadingFallback />}>
        <LoginCanvas reduced={reduced} />
      </Suspense>
    </div>
  );
}
