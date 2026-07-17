"use client";
import { useEffect } from "react";
import { useGLTF } from "@react-three/drei";

export const LOGIN_PEONY_URL = "/flowers/models/premium_login_peony.glb";

/**
 * GLB yuklovchi: sahifa ochilgach preload boshlanadi (lazy — birinchi renderni
 * bloklamaydi), drei kesh teksturalarni bir marta saqlaydi.
 */
export function useFlowerLoader() {
  useEffect(() => {
    // dastlabki bo'yashdan keyin — asosiy oqim band bo'lmaydi
    const id = window.requestIdleCallback
      ? window.requestIdleCallback(() => useGLTF.preload(LOGIN_PEONY_URL))
      : window.setTimeout(() => useGLTF.preload(LOGIN_PEONY_URL), 120);
    return () => {
      if (window.cancelIdleCallback && typeof id === "number") window.cancelIdleCallback(id);
      else clearTimeout(id as number);
    };
  }, []);
}
