"use client";
import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

/**
 * Yorug'lik dvigateli: yumshoq kalit + to'ldiruvchi + orqa nur,
 * va juda sekin harakatlanuvchi "quyosh" — sahna hech qachon o'lik turmaydi.
 * Fasl ranglari kadrma-kadr lerp qilinadi — fasl almashsa nur ohista quyiladi.
 */
const KEY = "#fff1e0";
const FILL = "#f5d5cd";

export default function LightingController({
  intensity = 1,
  moving = true,
  dark = false,
}: {
  intensity?: number;
  moving?: boolean;
  dark?: boolean;
}) {
  const sun = useRef<THREE.PointLight>(null);
  const key = useRef<THREE.DirectionalLight>(null);
  const fill = useRef<THREE.DirectionalLight>(null);
  const ambient = useRef<THREE.AmbientLight>(null);

  useFrame(({ clock }, delta) => {
    if (!sun.current || !moving) return;
    const t = clock.elapsedTime;
    // quyosh nuri sekin aylanib yuradi — soyalar tirik
    sun.current.position.x = Math.sin(t * 0.05) * 3;
    sun.current.position.y = 2 + Math.sin(t * 0.033 + 1) * 0.8;
    sun.current.intensity = (0.4 + 0.15 * Math.sin(t * 0.041)) * intensity;
  });

  return (
    <>
      <ambientLight ref={ambient} intensity={(dark ? 0.45 : 0.6) * intensity} />
      <directionalLight ref={key} position={[4, 6, 5]} intensity={1.05 * intensity} color={KEY} />
      <directionalLight ref={fill} position={[-5, 2, -3]} intensity={0.32 * intensity} color={FILL} />
      <pointLight ref={sun} position={[0, 2, 2.5]} intensity={0.5 * intensity} color={KEY} />
    </>
  );
}
