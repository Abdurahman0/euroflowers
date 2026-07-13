"use client";
import { useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { useWind } from "./WindController";

/**
 * Gulbarg zarra dvigateli — bitta InstancedMesh, yuzlab gulbarg 60 FPS'da.
 * Har zarra: o'z tezligi, aylanishi, o'lchami, chuqurligi, tushish fazasi.
 * Shamolga WindController orqali reaksiya qiladi — ochiq takror yo'q.
 */
export default function PetalEmitter({
  count = 60,
  color = "#e9c6c0",
  opacity = 0.5,
  area = 1.1,
  reducedMotion = false,
}: {
  count?: number;
  color?: string;
  opacity?: number;
  /** viewportga nisbatan gorizontal qamrov koeffitsienti */
  area?: number;
  reducedMotion?: boolean;
}) {
  const mesh = useRef<THREE.InstancedMesh>(null);
  const { viewport } = useThree();
  const wind = useWind();
  const dummy = useMemo(() => new THREE.Object3D(), []);

  const petalGeo = useMemo(() => {
    const geo = new THREE.PlaneGeometry(1, 1, 4, 6);
    const pos = geo.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) {
      const u = pos.getX(i) + 0.5;
      const v = pos.getY(i) + 0.5;
      const profile = Math.sin(Math.PI * Math.pow(v, 0.75));
      pos.setXYZ(i, (u - 0.5) * 0.55 * Math.max(profile, 0.05), v * 0.9, Math.pow(u - 0.5, 2) * 0.5 + v * v * 0.28);
    }
    geo.computeVertexNormals();
    return geo;
  }, []);

  // deterministik zarra parametrlari — SSR va resume xavfsiz
  const seeds = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => ({
        x: Math.sin(i * 127.3) * 0.5 + 0.5,
        speed: 0.1 + (Math.sin(i * 31.7) * 0.5 + 0.5) * 0.26,
        drift: Math.sin(i * 71.1) * 0.4,
        rot: Math.sin(i * 13.7) * Math.PI,
        rotSpeed: 0.2 + (Math.sin(i * 91.3) * 0.5 + 0.5) * 0.6,
        scale: 0.08 + (Math.sin(i * 53.9) * 0.5 + 0.5) * 0.18,
        phase: (Math.sin(i * 17.9) * 0.5 + 0.5) * 100,
        z: -1.2 - (Math.sin(i * 43.1) * 0.5 + 0.5) * 4,
        windK: 0.5 + (Math.sin(i * 23.3) * 0.5 + 0.5), // har biri shamolga har xil beriladi
      })),
    [count]
  );

  useFrame((state) => {
    if (!mesh.current) return;
    const t = reducedMotion ? 0 : state.clock.elapsedTime;
    const w = Math.max(viewport.width, 10);
    const h = Math.max(viewport.height, 7);
    const wd = wind.current;
    const windPush = reducedMotion ? 0 : (wd.strength + wd.gust * 0.8) * Math.cos(wd.direction) + wd.cursorX;

    seeds.forEach((s, i) => {
      const life = ((t * s.speed + s.phase) % 1.4) / 1.4;
      const y = h * 0.65 - life * h * 1.3;
      const x =
        (s.x - 0.5) * w * area +
        Math.sin(t * 0.4 + s.phase) * s.drift * 2 +
        windPush * s.windK * (0.6 + s.scale * 3);
      dummy.position.set(x, y, s.z);
      dummy.rotation.set(
        s.rot + t * s.rotSpeed * 0.5,
        s.rot * 1.3 + t * s.rotSpeed * (0.3 + wd.gust * 0.4),
        s.rot + t * s.rotSpeed * 0.44
      );
      // chetlarida so'nish o'rniga mayin kichrayish — shaffoflik o'zgarishi taassuroti
      const edgeFade = Math.min(1, 4 * Math.min(life, 1 - life) + 0.25);
      dummy.scale.setScalar(s.scale * edgeFade);
      dummy.updateMatrix();
      mesh.current!.setMatrixAt(i, dummy.matrix);
    });
    mesh.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={mesh} args={[petalGeo, undefined, count]} frustumCulled={false}>
      <meshStandardMaterial color={color} roughness={0.6} side={THREE.DoubleSide} transparent opacity={opacity} depthWrite={false} />
    </instancedMesh>
  );
}
