"use client";
import { EffectComposer, Bloom, DepthOfField } from "@react-three/postprocessing";

/**
 * Postprocessing dvigateli: yumshoq Bloom + kinematik DOF.
 * reduced-motion yoki past sifat rejimida umuman o'chadi.
 */
export default function BloomController({
  enabled = true,
  bloom = 0.35,
  dof = true,
}: {
  enabled?: boolean;
  bloom?: number;
  dof?: boolean;
}) {
  if (!enabled) return null;
  return (
    <EffectComposer>
      <Bloom intensity={bloom} luminanceThreshold={0.75} luminanceSmoothing={0.3} mipmapBlur />
      {dof ? <DepthOfField focusDistance={0.02} focalLength={0.06} bokehScale={2.2} /> : <></>}
    </EffectComposer>
  );
}
