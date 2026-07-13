"use client";
import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useWind } from "./WindController";

/** Suzuvchi changcha/mayda zarra qatlami — bitta Points, deyarli tekin. */
export default function FlowerParticles({
  count = 90,
  color = "#ffffff",
  size = 0.035,
  opacity = 0.5,
  reducedMotion = false,
}: {
  count?: number;
  color?: string;
  size?: number;
  opacity?: number;
  reducedMotion?: boolean;
}) {
  const points = useRef<THREE.Points>(null);
  const wind = useWind();

  const positions = useMemo(() => {
    const arr = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      arr[i * 3] = (Math.sin(i * 12.9) * 0.5 + 0.5 - 0.5) * 14;
      arr[i * 3 + 1] = (Math.sin(i * 78.2) * 0.5 + 0.5 - 0.5) * 9;
      arr[i * 3 + 2] = -2 - (Math.sin(i * 45.6) * 0.5 + 0.5) * 4;
    }
    return arr;
  }, [count]);

  useFrame(({ clock }) => {
    if (!points.current || reducedMotion) return;
    const t = clock.elapsedTime;
    const wd = wind.current;
    points.current.rotation.y = t * 0.012 + wd.cursorX * 0.05;
    points.current.position.y = Math.sin(t * 0.2) * 0.3;
    points.current.position.x = wd.strength * 0.4 * Math.cos(wd.direction);
  });

  return (
    <points ref={points}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial color={color} size={size} transparent opacity={opacity} sizeAttenuation depthWrite={false} />
    </points>
  );
}
