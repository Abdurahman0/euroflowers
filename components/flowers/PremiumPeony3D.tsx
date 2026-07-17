"use client";
import { Suspense, useEffect, useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { useGLTF, ContactShadows } from "@react-three/drei";
import * as THREE from "three";
import EnvironmentController from "@/components/three/engine/EnvironmentController";
import { FlowerController } from "./FlowerController";
import { useFlowerClock } from "./useFlowerClock";

/**
 * Premium piyonning 3D varianti — faqat NEXT_PUBLIC_ENABLE_3D=1 bo'lganda
 * dynamic import orqali yuklanadi (PremiumPeony.tsx'dagi bayroqqa qarang).
 *   • WindIdle abadiy aylanadi; Opening/Closing/Closed/FullyBloomed mahalliy
 *     vaqt bo'yicha boshqariladi (useFlowerClock), krossfeyd bilan.
 *   • Shaffof fon, ACES + sRGB, yumshoq kontakt soya.
 */

const GLB_URL = "/flowers/models/premium_peony.glb";
const TARGET_HEIGHT = 2.3;

function PeonyModel() {
  const { scene, animations } = useGLTF(GLB_URL);
  const group = useRef<THREE.Group>(null);
  const clock = useFlowerClock();
  const controller = useRef<FlowerController | null>(null);

  // o'lchamni normallash — Blender masshtabidan qat'i nazar
  const fit = useMemo(() => {
    const box = new THREE.Box3().setFromObject(scene);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    const k = TARGET_HEIGHT / Math.max(size.y, 1e-4);
    scene.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (mesh.isMesh) {
        mesh.castShadow = true;
        mesh.frustumCulled = false; // gulbarg animatsiyasi bbox'dan chiqib ketadi
      }
    });
    return { k, offset: new THREE.Vector3(-center.x * k, -box.min.y * k, -center.z * k) };
  }, [scene]);

  // kontroller hayoti — mount/unmount bilan, resurslar tozalanadi
  useEffect(() => {
    controller.current = new FlowerController(scene, animations);
    controller.current.setPhase(clock.phase, clock.progress);
    return () => {
      controller.current?.dispose();
      controller.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scene, animations]);

  // faza almashganda — silliq o'tish
  useEffect(() => {
    controller.current?.setPhase(clock.phase, clock.progress);
  }, [clock]);

  useFrame((_, delta) => controller.current?.update(Math.min(delta, 0.05)));

  return (
    <group ref={group} position={fit.offset} scale={fit.k}>
      <primitive object={scene} />
    </group>
  );
}

export default function PremiumPeony3D() {
  return (
    <Canvas
      dpr={[1, 2]}
      camera={{ position: [0, 7.6, 0.001], fov: 32 }}
      gl={{ antialias: true, alpha: true, powerPreference: "low-power" }}
      shadows="soft"
      style={{ background: "transparent" }}
      frameloop="always"
      onCreated={({ gl, camera }) => {
        gl.toneMapping = THREE.ACESFilmicToneMapping;
        gl.toneMappingExposure = 1.1;
        gl.outputColorSpace = THREE.SRGBColorSpace;
        // to'liq tepadan (bird's-eye) — gul markazga qaraymiz
        camera.lookAt(0, 1.6, 0);
      }}
    >
      <EnvironmentController intensity={0.75} />
      <directionalLight position={[3, 5, 4]} intensity={1.1} color="#fff0dd" castShadow shadow-mapSize={[512, 512]} />
      <directionalLight position={[-4, 2, -2]} intensity={0.3} color="#f3d5cc" />
      <Suspense fallback={null}>
        <PeonyModel />
        <ContactShadows position={[0, -0.02, 0]} opacity={0.3} scale={4.5} blur={2.6} far={2.5} resolution={256} frames={Infinity} />
      </Suspense>
    </Canvas>
  );
}
