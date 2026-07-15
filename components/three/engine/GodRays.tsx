"use client";
import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

/**
 * Juda nozik xudo nurlari — additiv aralashmali 3 ta qiya nur tekisligi.
 * Alfa niqob canvas'da chiziladi (tashqi fayl kerak emas), yorqinligi juda
 * sekin "nafas oladi". Chalg'itmaydi — atmosfera beradi, xolos.
 */

function makeShaftTexture(): THREE.Texture {
  const c = document.createElement("canvas");
  c.width = 128;
  c.height = 256;
  const ctx = c.getContext("2d")!;
  const img = ctx.createImageData(128, 256);
  for (let y = 0; y < 256; y++) {
    for (let x = 0; x < 128; x++) {
      const u = x / 127;
      const v = y / 255;
      // gorizontal yumshoq deraza × tepadan pastga so'nish
      const window = Math.pow(Math.sin(Math.PI * u), 2.2);
      const fall = Math.pow(1 - v, 1.6);
      const a = Math.round(window * fall * 255);
      const idx = (y * 128 + x) * 4;
      img.data[idx] = 255;
      img.data[idx + 1] = 250;
      img.data[idx + 2] = 240;
      img.data[idx + 3] = a;
    }
  }
  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(c);
  tex.needsUpdate = true;
  return tex;
}

const SHAFTS = [
  { x: -1.6, rot: 0.32, w: 1.6, h: 7, phase: 0.4, base: 0.04 },
  { x: 0.4, rot: 0.2, w: 2.4, h: 8, phase: 2.1, base: 0.058 },
  { x: 2.1, rot: 0.42, w: 1.2, h: 6.5, phase: 4.6, base: 0.034 },
];

export default function GodRays({ intensity = 1, reducedMotion = false }: { intensity?: number; reducedMotion?: boolean }) {
  const mats = useRef<(THREE.MeshBasicMaterial | null)[]>([]);
  const texture = useMemo(() => makeShaftTexture(), []);
  const color = useMemo(() => new THREE.Color("#fff1e0"), []);

  useFrame(({ clock }, delta) => {
    const t = clock.elapsedTime;
    SHAFTS.forEach((s, i) => {
      const m = mats.current[i];
      if (!m) return;
      m.color.copy(color);
      m.opacity = reducedMotion
        ? s.base * intensity
        : (s.base + Math.sin(t * 0.11 + s.phase) * 0.02 + Math.sin(t * 0.043 + s.phase * 2) * 0.012) * intensity;
    });
  });

  return (
    <group position={[0, 2.2, -1.6]} rotation={[0, 0, 0]}>
      {SHAFTS.map((s, i) => (
        <mesh key={i} position={[s.x, 0, i * -0.4]} rotation={[0, 0, s.rot]}>
          <planeGeometry args={[s.w, s.h]} />
          <meshBasicMaterial
            ref={(el) => {
              mats.current[i] = el;
            }}
            map={texture}
            transparent
            opacity={s.base}
            depthWrite={false}
            blending={THREE.AdditiveBlending}
          />
        </mesh>
      ))}
    </group>
  );
}
