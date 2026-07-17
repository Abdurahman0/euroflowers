"use client";
import { useEffect, useMemo, useRef } from "react";
import { useGLTF, useAnimations } from "@react-three/drei";
import * as THREE from "three";
import { LOGIN_PEONY_URL } from "@/hooks/useFlowerLoader";

/**
 * Blender buketi — yagona haqiqat manbai.
 * Kompozitsiya (stol + vaza + buket) aynan eksport qilinganidek;
 * faqat butun guruh birlik masshtabga keltiriladi.
 * FAQAT "Breeze" klipi ijro etiladi — abadiy, uzilishsiz, qayta yaratilmaydi.
 */
export default function FlowerModel({ reduced }: { reduced: boolean }) {
  const group = useRef<THREE.Group>(null);
  const { scene, animations } = useGLTF(LOGIN_PEONY_URL);
  const { actions } = useAnimations(animations, group);

  const fit = useMemo(() => {
    const box = new THREE.Box3().setFromObject(scene);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    const k = 3 / Math.max(size.y, 1e-4);
    scene.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (mesh.isMesh) {
        mesh.castShadow = true;
        mesh.receiveShadow = true;
      }
    });
    return { k, offset: new THREE.Vector3(-center.x * k, -box.min.y * k, -center.z * k) };
  }, [scene]);

  useEffect(() => {
    const breeze = actions["Breeze"];
    if (!breeze) return;
    breeze.reset();
    breeze.setLoop(THREE.LoopRepeat, Infinity);
    breeze.play();
    // reduced-motion: pauza (kadr saqlanadi, hech narsa qayta boshlanmaydi)
    breeze.paused = reduced;
    return () => {
      breeze.stop();
    };
  }, [actions, reduced]);

  return (
    <group ref={group} position={fit.offset} scale={fit.k}>
      <primitive object={scene} />
    </group>
  );
}
