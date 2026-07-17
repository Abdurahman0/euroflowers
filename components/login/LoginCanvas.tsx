"use client";
import { Suspense, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { AdaptiveDpr, AdaptiveEvents } from "@react-three/drei";
import * as THREE from "three";
import FlowerModel from "./FlowerModel";
import SceneLighting from "./SceneLighting";
import ContactShadow from "./ContactShadow";

/**
 * 3D canvas qobig'i: shaffof fon, ACES + sRGB, yumshoq soyalar,
 * adaptiv DPR/hodisalar, va ≤2° sichqoncha rotatsiyasi (deyarli sezilmas).
 * Kamera Blender preview kadriga moslangan; orbit/zoom yo'q.
 */

const MAX_TILT = THREE.MathUtils.degToRad(2);

function TiltRig({ children, reduced }: { children: React.ReactNode; reduced: boolean }) {
  const ref = useRef<THREE.Group>(null);
  useFrame(({ pointer }, delta) => {
    if (!ref.current || reduced) return;
    const k = 1 - Math.exp(-delta * 2.2);
    ref.current.rotation.y += (pointer.x * MAX_TILT - ref.current.rotation.y) * k;
    ref.current.rotation.x += (-pointer.y * MAX_TILT * 0.6 - ref.current.rotation.x) * k;
  });
  return <group ref={ref}>{children}</group>;
}

export default function LoginCanvas({ reduced }: { reduced: boolean }) {
  return (
    <Canvas
      dpr={[1, 2]}
      camera={{ position: [0.12, 2.75, 5.7], fov: 37 }}
      shadows="soft"
      gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
      style={{ background: "transparent" }}
      frameloop={reduced ? "demand" : "always"}
      onCreated={({ gl, camera }) => {
        // Blender ko'rinishiga eng yaqin chiqish: ACES filmik + sRGB, ekspozitsiya 1
        gl.toneMapping = THREE.ACESFilmicToneMapping;
        gl.toneMappingExposure = 1;
        gl.outputColorSpace = THREE.SRGBColorSpace;
        camera.lookAt(0, 1.25, 0);
      }}
    >
      <AdaptiveDpr pixelated={false} />
      <AdaptiveEvents />
      <SceneLighting />
      <Suspense fallback={null}>
        <TiltRig reduced={reduced}>
          <FlowerModel reduced={reduced} />
          <ContactShadow />
        </TiltRig>
      </Suspense>
    </Canvas>
  );
}
