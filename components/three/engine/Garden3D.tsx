"use client";
import SceneController from "./SceneController";
import LightingController from "./LightingController";
import GardenFlora from "./GardenFlora";
import FlowerParticles from "./FlowerParticles";

/**
 * Botanika bog'ining 3D qatlami (uzoq gul + changcha, og'ir blur) —
 * faqat NEXT_PUBLIC_ENABLE_3D=1 bo'lganda dynamic import bilan yuklanadi.
 */
export default function Garden3D({ dark, reduced }: { dark: boolean; reduced: boolean }) {
  return (
    <div className="absolute inset-0" style={{ filter: "blur(8px) saturate(0.95)" }}>
      <SceneController parallax={0.35} windBase={0.4} reducedMotion={reduced} dpr={[1, 1.25]}>
        <LightingController intensity={dark ? 0.6 : 0.9} moving={!reduced} dark={dark} />
        <GardenFlora reducedMotion={reduced} />
        <FlowerParticles count={54} reducedMotion={reduced} />
      </SceneController>
    </div>
  );
}
