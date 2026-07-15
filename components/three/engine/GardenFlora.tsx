"use client";
import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { useWind } from "./WindController";
import { FLOWER_MODELS } from "./assets";

/**
 * Bog' gullari — Blender piyonlari fon chuqurligida.
 * Har biri o'z urug'i bilan chayqaladi/nafas oladi; UI oldiga hech qachon chiqmaydi.
 * Butun canvas tashqaridan blur qilinadi (DOF taassuroti) — bu yerda faqat harakat.
 */

const TARGET_HEIGHT = 2.2;

function GardenPeony({
  url,
  position,
  scale = 1,
  seed = 1,
  dim = 0.85,
  reducedMotion = false,
}: {
  url: string;
  position: [number, number, number];
  scale?: number;
  seed?: number;
  /** fon uchun xiralashtirish — material ranglari biroz so'ndiriladi */
  dim?: number;
  reducedMotion?: boolean;
}) {
  const { scene } = useGLTF(url);
  const ref = useRef<THREE.Group>(null);
  const wind = useWind();

  // klonlash — bir GLB bir nechta joyda mustaqil turishi uchun;
  // fon nusxasi ranglarini biroz so'ndiramiz (chuqurlik hissi)
  const inst = useMemo(() => {
    const clone = scene.clone(true);
    const box = new THREE.Box3().setFromObject(clone);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    const k = TARGET_HEIGHT / Math.max(size.y, 1e-4);
    clone.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (mesh.isMesh && mesh.material) {
        const m = (mesh.material as THREE.MeshStandardMaterial).clone();
        if (m.color) m.color.multiplyScalar(dim);
        m.transparent = true;
        m.opacity = 0.75; // uzoq fon guli — yumshoq, lekin aniq ko'rinadi
        mesh.material = m;
      }
    });
    return { clone, k, offset: new THREE.Vector3(-center.x * k, -box.min.y * k, -center.z * k) };
  }, [scene, dim]);

  useFrame(({ clock }) => {
    if (!ref.current || reducedMotion) return;
    const t = clock.elapsedTime;
    const wd = wind.current;
    const amp = 0.5 + wd.strength + wd.gust * 1.1;
    ref.current.rotation.z = (Math.sin(t * 0.42 + seed) * 0.026 + Math.sin(t * 0.19 + seed * 2.7) * 0.017) * amp + wd.cursorX * 0.01;
    ref.current.rotation.y = Math.sin(t * 0.13 + seed * 1.7) * 0.06 * amp;
    const breathe = 1 + Math.sin(t * 0.7 + seed) * 0.014;
    ref.current.scale.setScalar(scale * breathe);
  });

  return (
    <group ref={ref} position={position} scale={scale}>
      <group position={inst.offset} scale={inst.k}>
        <primitive object={inst.clone} />
      </group>
    </group>
  );
}

export default function GardenFlora({ reducedMotion = false }: { reducedMotion?: boolean }) {
  return (
    <>
      {/* yagona bog' guli: o'ng past burchak, chuqur DOF ortida — markaz doim bo'sh */}
      <GardenPeony url={FLOWER_MODELS.cream} position={[2.1, -2.5, -1.9]} scale={1.2} seed={13} dim={0.82} reducedMotion={reducedMotion} />
    </>
  );
}

useGLTF.preload(FLOWER_MODELS.cream);
