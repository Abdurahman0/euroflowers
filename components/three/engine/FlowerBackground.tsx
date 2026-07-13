"use client";
import SceneController, { usePrefersReducedMotion } from "./SceneController";
import LightingController from "./LightingController";
import PetalEmitter from "./PetalEmitter";
import FlowerParticles from "./FlowerParticles";
import { useTheme } from "@/lib/store";

/**
 * Ilova foni — qatlamlar:
 *   1) harakatlanuvchi yumshoq gradientlar (CSS)
 *   2) 3D gulbarg emitteri + changcha (bitta yengil canvas, kursor parallaksi)
 * Ustida glass UI turadi. Hech qachon statik emas, hech qachon chalg'itmaydi.
 */
export default function FlowerBackground() {
  const { theme, dark } = useTheme();
  const reduced = usePrefersReducedMotion();

  return (
    <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden" aria-hidden>
      {/* 1-qatlam: tirik gradientlar */}
      <div
        className="absolute -left-[15%] top-[-10%] h-[55vh] w-[55vh] rounded-full blur-[70px]"
        style={{
          background: `radial-gradient(circle, color-mix(in srgb, ${theme.accL} ${dark ? 14 : 42}%, transparent), transparent 70%)`,
          animation: reduced ? undefined : "gentleFloat 11s ease-in-out infinite",
        }}
      />
      <div
        className="absolute right-[-10%] top-[35%] h-[48vh] w-[48vh] rounded-full blur-[80px]"
        style={{
          background: `radial-gradient(circle, color-mix(in srgb, ${theme.accent} ${dark ? 10 : 20}%, transparent), transparent 70%)`,
          animation: reduced ? undefined : "gentleFloat 14s ease-in-out infinite reverse",
        }}
      />
      <div
        className="absolute bottom-[-12%] left-[28%] h-[50vh] w-[50vh] rounded-full blur-[75px]"
        style={{
          background: `radial-gradient(circle, rgba(255,252,244,${dark ? 0.05 : 0.5}), transparent 68%)`,
          animation: reduced ? undefined : "glowPulse 9s ease-in-out infinite",
        }}
      />

      {/* 2-qatlam: gulbarglar + changcha */}
      <SceneController parallax={1} windBase={0.55} reducedMotion={reduced}>
        <LightingController intensity={dark ? 0.7 : 1} moving={!reduced} dark={dark} />
        <PetalEmitter count={54} color={theme.accL} reducedMotion={reduced} />
        <FlowerParticles count={80} reducedMotion={reduced} />
      </SceneController>
    </div>
  );
}
