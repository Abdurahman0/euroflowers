"use client";
import { Suspense, useEffect, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useAnimations, useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { LOADING_FLOWER } from "./engine/assets";
import { usePrefersReducedMotion } from "./engine/SceneController";
import EnvironmentController from "./engine/EnvironmentController";

/**
 * Yuklanish guli — Blender'dan eksport qilingan white_peony_loading.glb:
 * g'uncha → ochilish → gullash → tin olish → yopilish → sikl (12s, 54 klip).
 * Hech qanday spinner yo'q — gulning o'zi yuklanish indikatori.
 */

function Model({ reduced }: { reduced: boolean }) {
  const { scene, animations } = useGLTF(LOADING_FLOWER);
  const ref = useRef<THREE.Group>(null);
  const { actions, names, mixer } = useAnimations(animations, ref);
  const { camera } = useThree();

  useEffect(() => {
    // barcha kliplar bitta 12s xronologiyaning bo'laklari — sinxron ijro etiladi
    names.forEach((n) => {
      const a = actions[n];
      if (!a) return;
      a.reset();
      a.setLoop(THREE.LoopRepeat, Infinity);
      a.play();
    });

    // kamerani to'liq ochilgan holatga qarab kadrga olamiz
    mixer.setTime(6);
    scene.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(scene);
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z);
    const fov = ((camera as THREE.PerspectiveCamera).fov * Math.PI) / 180;
    const dist = (maxDim / (2 * Math.tan(fov / 2))) * 1.28;
    camera.position.set(center.x + dist * 0.12, center.y + size.y * 0.08, center.z + dist);
    camera.lookAt(center);
    mixer.setTime(0);

    if (reduced) {
      // harakat kamaytirilgan rejim — gul ochilgan kadrda tinch turadi
      mixer.setTime(6);
      mixer.timeScale = 0;
    } else {
      mixer.timeScale = 1;
    }
    return () => {
      names.forEach((n) => actions[n]?.stop());
    };
  }, [actions, names, mixer, scene, camera, reduced]);

  useFrame(({ clock }) => {
    if (!ref.current || reduced) return;
    const t = clock.elapsedTime;
    // juda mayin poya chayqalishi — sikl mexanik tuyulmasin
    ref.current.rotation.z = Math.sin(t * 0.4) * 0.02;
    ref.current.rotation.y = Math.sin(t * 0.17) * 0.06;
  });

  return (
    <group ref={ref}>
      <primitive object={scene} />
    </group>
  );
}

export default function LoadingFlower() {
  const reduced = usePrefersReducedMotion();
  return (
    <Canvas
      dpr={[1, 1.5]}
      camera={{ position: [0, 0.6, 3.4], fov: 38 }}
      gl={{ antialias: true, alpha: true, powerPreference: "low-power" }}
      frameloop={reduced ? "demand" : "always"}
      style={{ width: "100%", height: "100%" }}
      onCreated={({ gl }) => {
        gl.toneMapping = THREE.ACESFilmicToneMapping;
        gl.outputColorSpace = THREE.SRGBColorSpace;
      }}
    >
      <EnvironmentController intensity={0.6} />
      <ambientLight intensity={0.65} />
      <directionalLight position={[3, 5, 4]} intensity={1.1} color="#fff0dd" />
      <directionalLight position={[-4, 2, -3]} intensity={0.3} color="#f3d0c8" />
      <Suspense fallback={null}>
        <Model reduced={reduced} />
      </Suspense>
    </Canvas>
  );
}

useGLTF.preload(LOADING_FLOWER);
