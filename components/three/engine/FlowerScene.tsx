"use client";
import SceneController, { usePrefersReducedMotion } from "./SceneController";
import LightingController from "./LightingController";
import RealPetals from "./RealPetals";
import FlowerParticles from "./FlowerParticles";
import BloomController from "./BloomController";
import GodRays from "./GodRays";
import PetalRelease from "./PetalRelease";
import { useSeason } from "./SeasonController";
import RealisticFlower from "../RealisticFlower";

/**
 * Tayyor gul sahnasi: yorug'lik + gul(lar) + gulbarg va changcha zarralari +
 * ixtiyoriy postprocessing. Login va boshqa "qahramon" sahnalar shundan quriladi.
 */
export default function FlowerScene({
  bloom,
  flyAway = false,
  autoCycle = false,
  petals = 26,
  particles = 60,
  post = true,
  rays = false,
  parallaxCamera = false,
  cameraRig,
  prefer,
}: {
  bloom?: number;
  flyAway?: boolean;
  autoCycle?: boolean;
  petals?: number;
  particles?: number;
  post?: boolean;
  /** nozik xudo nurlari (login kabi qahramon sahnalar uchun) */
  rays?: boolean;
  parallaxCamera?: boolean;
  /** maxsus kamera boshqaruvi (masalan login rig) */
  cameraRig?: React.ReactNode;
  prefer?: string;
}) {
  const reduced = usePrefersReducedMotion();
  const season = useSeason();
  return (
    <SceneController
      camera={{ position: [0, 0.2, 5.2], fov: 42 }}
      dpr={[1, 1.75]}
      parallax={parallaxCamera ? 0.6 : 0}
      windBase={season.wind}
      lowPower={false}
      reducedMotion={reduced}
    >
      <LightingController intensity={1.15} moving={!reduced} />
      {rays && <GodRays reducedMotion={reduced} />}
      <group position={[0, 1.12, 0]}>
        <RealisticFlower bloom={bloom} flyAway={flyAway} autoCycle={autoCycle} scale={1.15} seed={7} reducedMotion={reduced} prefer={prefer} />
      </group>
      <PetalRelease active={flyAway} position={[0, 1.3, 0.15]} />
      <RealPetals count={petals} reducedMotion={reduced} />
      <FlowerParticles count={particles} reducedMotion={reduced} />
      {post && !reduced && <BloomController />}
      {cameraRig}
    </SceneController>
  );
}
