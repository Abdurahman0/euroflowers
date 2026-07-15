"use client";
import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useWind } from "./WindController";

/**
 * Suzuvchi changcha/qor zarra qatlami — bitta Points, deyarli tekin.
 * Fasl rangi kadrma-kadr lerp qilinadi, zichlik drawRange bilan silliq o'zgaradi
 * (qish — sekin oq zarralar, yoz — iliq oltin changcha).
 */
const POLLEN = "#fff4d6";

export default function FlowerParticles({
  count = 90,
  size = 0.035,
  opacity = 0.5,
  reducedMotion = false,
}: {
  /** bazaviy zarra soni — fasl zichligi bilan 2x gacha ko'payadi */
  count?: number;
  size?: number;
  opacity?: number;
  reducedMotion?: boolean;
}) {
  const points = useRef<THREE.Points>(null);
  const mat = useRef<THREE.PointsMaterial>(null);
  const geo = useRef<THREE.BufferGeometry>(null);
  const visible = useRef(count);
  const wind = useWind();

  const capacity = count * 2;
  const positions = useMemo(() => {
    const arr = new Float32Array(capacity * 3);
    for (let i = 0; i < capacity; i++) {
      arr[i * 3] = (Math.sin(i * 12.9) * 0.5 + 0.5 - 0.5) * 14;
      arr[i * 3 + 1] = (Math.sin(i * 78.2) * 0.5 + 0.5 - 0.5) * 9;
      arr[i * 3 + 2] = -2 - (Math.sin(i * 45.6) * 0.5 + 0.5) * 4;
    }
    return arr;
  }, [capacity]);

  useFrame(({ clock }, delta) => {
    const k = 1 - Math.exp(-delta * 1.2);
    visible.current += (count - visible.current) * k;
    geo.current?.setDrawRange(0, Math.round(visible.current));
    if (!points.current || reducedMotion) return;
    const t = clock.elapsedTime;
    const wd = wind.current;
    points.current.rotation.y = t * 0.012 + wd.cursorX * 0.05;
    points.current.position.y = Math.sin(t * 0.2) * 0.3;
    points.current.position.x = wd.strength * 0.4 * Math.cos(wd.direction);
  });

  return (
    <points ref={points}>
      <bufferGeometry ref={geo}>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial ref={mat} color={POLLEN} size={size} transparent opacity={opacity} sizeAttenuation depthWrite={false} />
    </points>
  );
}
