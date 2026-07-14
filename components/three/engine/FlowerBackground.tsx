"use client";
import SceneController, { usePrefersReducedMotion } from "./SceneController";
import LightingController from "./LightingController";
import RealPetals from "./RealPetals";
import FlowerParticles from "./FlowerParticles";
import { useSeason } from "./SeasonController";
import { useTheme } from "@/lib/store";
import BackgroundFlowers from "@/components/BackgroundFlowers";

/**
 * Ilova foni — qatlamma-qatlam chuqurlik (orqadan oldinga):
 *   1) osmon: fasl rangli tirik gradientlar (CSS, @property bilan silliq)
 *   2) yumshoq tuman (fasl kuchi --fog-k)
 *   3) barg-soyalar + katta haqiqiy gul suratlari (DOM parallaks)
 *   4) 3D: haqiqiy Blender gulbarglari + changcha (kursor parallaksi)
 * Ustida glass UI turadi. Har qatlam har xil tezlikda harakatlanadi.
 */
export default function FlowerBackground() {
  const { theme, dark } = useTheme();
  const season = useSeason();
  const reduced = usePrefersReducedMotion();

  return (
    <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden" aria-hidden>
      {/* 1-qatlam: osmon — fasl gradientlari (eng sekin qatlam) */}
      <div
        className="absolute inset-0"
        style={{
          background: `linear-gradient(180deg, color-mix(in srgb, var(--glow-c) ${dark ? 7 : 26}%, transparent), transparent 55%)`,
          transform: "translate3d(calc(var(--plx-x, 0px) * 1), calc(var(--plx-y, 0px) * 1), 0)",
        }}
      />
      <div
        className="absolute -left-[15%] top-[-10%] h-[55vh] w-[55vh] rounded-full blur-[70px]"
        style={{
          background: `radial-gradient(circle, color-mix(in srgb, var(--glow-a) ${dark ? 16 : 44}%, transparent), transparent 70%)`,
          animation: reduced ? undefined : "gentleFloat 11s ease-in-out infinite",
        }}
      />
      <div
        className="absolute right-[-10%] top-[35%] h-[48vh] w-[48vh] rounded-full blur-[80px]"
        style={{
          background: `radial-gradient(circle, color-mix(in srgb, ${theme.accent} ${dark ? 10 : 18}%, var(--glow-b)) , transparent 70%)`,
          opacity: dark ? 0.14 : 0.4,
          animation: reduced ? undefined : "gentleFloat 14s ease-in-out infinite reverse",
        }}
      />
      <div
        className="absolute bottom-[-12%] left-[28%] h-[50vh] w-[50vh] rounded-full blur-[75px]"
        style={{
          background: `radial-gradient(circle, color-mix(in srgb, var(--glow-c) ${dark ? 12 : 52}%, transparent), transparent 68%)`,
          animation: reduced ? undefined : "glowPulse 9s ease-in-out infinite",
        }}
      />

      {/* 2-qatlam: yumshoq tuman — sekin oqadi */}
      <div
        className="fog-band absolute left-[-30%] top-[22%] h-[34vh] w-[160%]"
        style={{ opacity: `calc(var(--fog-k, 0.32) * ${dark ? 0.5 : 1})` }}
      />
      <div
        className="fog-band fog-band-2 absolute bottom-[8%] left-[-30%] h-[28vh] w-[160%]"
        style={{ opacity: `calc(var(--fog-k, 0.32) * ${dark ? 0.4 : 0.75})` }}
      />

      {/* 3-qatlam: barg-soyalar + katta haqiqiy gullar (DOM parallaks) */}
      <BackgroundFlowers />

      {/* 4-qatlam: 3D — haqiqiy gulbarglar + changcha */}
      <SceneController parallax={1} windBase={season.wind} reducedMotion={reduced}>
        <LightingController intensity={dark ? 0.7 : 1} moving={!reduced} dark={dark} />
        <RealPetals count={44} reducedMotion={reduced} />
        <FlowerParticles count={70} reducedMotion={reduced} />
      </SceneController>
    </div>
  );
}
