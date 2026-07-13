"use client";
import SceneController, { usePrefersReducedMotion } from "./SceneController";
import LightingController from "./LightingController";
import PetalEmitter from "./PetalEmitter";
import FlowerParticles from "./FlowerParticles";
import BloomController from "./BloomController";
import RealisticFlower from "../RealisticFlower";

/**
 * Tayyor gul sahnasi: yorug'lik + gul(lar) + gulbarg va changcha zarralari +
 * ixtiyoriy postprocessing. Login va boshqa "qahramon" sahnalar shundan quriladi.
 */
export default function FlowerScene({
  bloom,
  flyAway = false,
  autoCycle = false,
  petalColor = "#e9c6c0",
  petals = 26,
  particles = 60,
  post = true,
  parallaxCamera = false,
  cameraRig,
  prefer,
}: {
  bloom?: number;
  flyAway?: boolean;
  autoCycle?: boolean;
  petalColor?: string;
  petals?: number;
  particles?: number;
  post?: boolean;
  parallaxCamera?: boolean;
  /** maxsus kamera boshqaruvi (masalan login rig) */
  cameraRig?: React.ReactNode;
  prefer?: string;
}) {
  const reduced = usePrefersReducedMotion();
  return (
    <SceneController
      camera={{ position: [0, 0.2, 5.2], fov: 42 }}
      dpr={[1, 1.75]}
      parallax={parallaxCamera ? 0.6 : 0}
      lowPower={false}
      reducedMotion={reduced}
    >
      <LightingController intensity={1} moving={!reduced} />
      <group position={[0, 0.35, 0]}>
        <RealisticFlower bloom={bloom} flyAway={flyAway} autoCycle={autoCycle} scale={1.15} seed={7} reducedMotion={reduced} prefer={prefer} />
      </group>
      <PetalEmitter count={petals} color={petalColor} reducedMotion={reduced} />
      <FlowerParticles count={particles} reducedMotion={reduced} />
      {post && !reduced && <BloomController />}
      {cameraRig}
    </SceneController>
  );
}
