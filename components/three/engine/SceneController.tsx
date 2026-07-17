"use client";
import { Suspense, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { Group } from "three";
import WindController from "./WindController";
import EnvironmentController from "./EnvironmentController";
import { useWebGL } from "@/lib/webgl";
import { usePrefersReducedMotion } from "@/lib/motion";

/**
 * Sahna dvigateli: Canvas + shamol provayderi + ixtiyoriy kursor parallaksi.
 * Barcha 3D sahnalar shu qobiq orqali quriladi — dpr, event manbai,
 * frameloop siyosati bir joyda.
 */

// meros: three'siz iste'molchilar to'g'ridan-to'g'ri @/lib/motion'dan olsin
export { usePrefersReducedMotion } from "@/lib/motion";

function ParallaxRig({ children, amount, reduced }: { children: React.ReactNode; amount: number; reduced: boolean }) {
  const ref = useRef<Group>(null);
  useFrame(({ pointer }, delta) => {
    if (!ref.current || reduced || amount === 0) return;
    const k = 1 - Math.exp(-delta * 1.6);
    ref.current.position.x += (pointer.x * 0.35 * amount - ref.current.position.x) * k;
    ref.current.position.y += (pointer.y * 0.22 * amount - ref.current.position.y) * k;
    ref.current.rotation.y += (pointer.x * 0.03 * amount - ref.current.rotation.y) * k;
  });
  return <group ref={ref}>{children}</group>;
}

export default function SceneController({
  children,
  camera = { position: [0, 0, 6] as [number, number, number], fov: 50 },
  dpr = [1, 1.5] as [number, number],
  parallax = 0,
  windBase = 0.5,
  lowPower = true,
  envIntensity = 0.6,
  reducedMotion,
  className,
}: {
  children: React.ReactNode;
  camera?: { position: [number, number, number]; fov: number };
  dpr?: [number, number];
  /** 0 — o'chiq, 1 — to'liq kursor parallaksi */
  parallax?: number;
  windBase?: number;
  lowPower?: boolean;
  /** muhit (IBL) kuchi — PBR materiallar uchun */
  envIntensity?: number;
  reducedMotion?: boolean;
  className?: string;
}) {
  const autoReduced = usePrefersReducedMotion();
  const reduced = reducedMotion ?? autoReduced;
  const glOk = useWebGL();

  // GPU yo'q — 3D qatlam tashlab yuboriladi, CSS fon o'z holicha qoladi
  if (!glOk) return null;

  return (
    <Canvas
      dpr={dpr}
      camera={camera}
      gl={{ antialias: true, alpha: true, powerPreference: lowPower ? "low-power" : "high-performance" }}
      style={{ position: "absolute", inset: 0 }}
      className={className}
      frameloop={reduced ? "demand" : "always"}
      eventSource={typeof document !== "undefined" ? document.body : undefined}
      eventPrefix="client"
      onCreated={({ gl }) => {
        // deterministik chiqish: ACES + sRGB — Blender ko'rinishiga eng yaqin
        gl.toneMapping = THREE.ACESFilmicToneMapping;
        gl.toneMappingExposure = 1;
        gl.outputColorSpace = THREE.SRGBColorSpace;
      }}
    >
      <EnvironmentController intensity={envIntensity} />
      <WindController base={windBase} reducedMotion={reduced}>
        <Suspense fallback={null}>
          <ParallaxRig amount={parallax} reduced={reduced}>
            {children}
          </ParallaxRig>
        </Suspense>
      </WindController>
    </Canvas>
  );
}
