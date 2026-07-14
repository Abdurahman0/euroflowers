"use client";
import { useEffect, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import FlowerScene from "./engine/FlowerScene";

/** Kamera: kursor parallaksi + muvaffaqiyatda gul ichiga suzish. */
function CameraRig({ success }: { success: boolean }) {
  const base = useRef(new THREE.Vector3(0, 0.2, 5.2));
  const aimY = useRef(0.3);
  useFrame(({ camera, pointer }, delta) => {
    const dest = success
      ? new THREE.Vector3(0, 1.15, 2.3)
      : new THREE.Vector3(base.current.x + pointer.x * 0.28, base.current.y + pointer.y * 0.18, base.current.z);
    camera.position.lerp(dest, 1 - Math.exp(-delta * (success ? 1.6 : 2)));
    // muvaffaqiyatda nigoh gul boshiga ohista ko'chadi
    aimY.current += ((success ? 1.12 : 0.3) - aimY.current) * (1 - Math.exp(-delta * 1.6));
    camera.lookAt(0, aimY.current, 0);
  });
  return null;
}

/**
 * Login sahnasi — Flower Engine'ning FlowerScene kompoziti.
 * Yuklanishda gul sekin ochiladi; `success`da gulbarglar uchadi, kamera suzadi.
 */
export default function LoginScene({ success }: { success: boolean }) {
  const [bloomIn, setBloomIn] = useState(0);
  useEffect(() => {
    const t = setTimeout(() => setBloomIn(1), 350);
    return () => clearTimeout(t);
  }, []);

  return (
    <FlowerScene
      bloom={bloomIn}
      flyAway={success}
      autoCycle={false}
      petals={26}
      particles={60}
      post
      rays
      cameraRig={<CameraRig success={success} />}
    />
  );
}
