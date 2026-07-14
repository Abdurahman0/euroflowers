"use client";
import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useSeason } from "./SeasonController";

/**
 * Yorug'lik dvigateli: yumshoq kalit + to'ldiruvchi + orqa nur,
 * va juda sekin harakatlanuvchi "quyosh" — sahna hech qachon o'lik turmaydi.
 * Fasl ranglari kadrma-kadr lerp qilinadi — fasl almashsa nur ohista quyiladi.
 */
export default function LightingController({
  intensity = 1,
  moving = true,
  dark = false,
}: {
  intensity?: number;
  moving?: boolean;
  dark?: boolean;
}) {
  const season = useSeason();
  const sun = useRef<THREE.PointLight>(null);
  const key = useRef<THREE.DirectionalLight>(null);
  const fill = useRef<THREE.DirectionalLight>(null);
  const ambient = useRef<THREE.AmbientLight>(null);
  const target = useRef({ key: new THREE.Color(season.keyLight), fill: new THREE.Color(season.fillLight) });

  target.current.key.set(season.keyLight);
  target.current.fill.set(season.fillLight);

  useFrame(({ clock }, delta) => {
    const k = 1 - Math.exp(-delta * 1.2);
    key.current?.color.lerp(target.current.key, k);
    fill.current?.color.lerp(target.current.fill, k);
    sun.current?.color.lerp(target.current.key, k);
    if (ambient.current) {
      const want = (dark ? 0.45 : 0.6) * intensity * season.ambientK;
      ambient.current.intensity += (want - ambient.current.intensity) * k;
    }
    if (!sun.current || !moving) return;
    const t = clock.elapsedTime;
    // quyosh nuri sekin aylanib yuradi — soyalar tirik
    sun.current.position.x = Math.sin(t * 0.05) * 3;
    sun.current.position.y = 2 + Math.sin(t * 0.033 + 1) * 0.8;
    sun.current.intensity = (0.4 + 0.15 * Math.sin(t * 0.041)) * intensity;
  });

  return (
    <>
      <ambientLight ref={ambient} intensity={(dark ? 0.45 : 0.6) * intensity * season.ambientK} />
      <directionalLight ref={key} position={[4, 6, 5]} intensity={1.05 * intensity} color={season.keyLight} />
      <directionalLight ref={fill} position={[-5, 2, -3]} intensity={0.32 * intensity} color={season.fillLight} />
      <pointLight ref={sun} position={[0, 2, 2.5]} intensity={0.5 * intensity} color={season.keyLight} />
    </>
  );
}
