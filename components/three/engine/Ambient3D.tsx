"use client";
import SceneController from "./SceneController";
import LightingController from "./LightingController";
import RealPetals from "./RealPetals";
import FlowerParticles from "./FlowerParticles";

/**
 * Fon 3D qatlami (Blender gulbarglari + changcha) — faqat
 * NEXT_PUBLIC_ENABLE_3D=1 bo'lganda dynamic import bilan yuklanadi.
 */
export default function Ambient3D({ dark, reduced, petals }: { dark: boolean; reduced: boolean; petals: number }) {
  return (
    <SceneController parallax={1} windBase={0.5} reducedMotion={reduced}>
      <LightingController intensity={dark ? 0.7 : 1} moving={!reduced} dark={dark} />
      <RealPetals count={petals} opacity={0.4} reducedMotion={reduced} />
      <FlowerParticles count={50} reducedMotion={reduced} />
    </SceneController>
  );
}
