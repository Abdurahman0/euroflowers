"use client";
import { useEffect } from "react";
import { useThree } from "@react-three/fiber";
import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { RGBELoader } from "three/examples/jsm/loaders/RGBELoader.js";

/**
 * Muhit yorug'ligi (IBL) — PBR materiallar (sheen, specular, IOR) nurni shu
 * yerdan oladi. Busiz gulbarglar qop-qora, jonsiz ko'rinadi.
 *
 * Standart: three'ning RoomEnvironment studiyasi PMREM orqali — tarmoqsiz,
 * deterministik. `hdri` berilsa (masalan /flowers/hdri/studio.hdr) — HDRI
 * yuklanib, PMREM'ga aylantiriladi.
 */
export default function EnvironmentController({
  intensity = 0.6,
  hdri,
}: {
  intensity?: number;
  /** ixtiyoriy .hdr fayl yo'li (public/flowers/hdri/ ichida) */
  hdri?: string;
}) {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);

  useEffect(() => {
    const pmrem = new THREE.PMREMGenerator(gl);
    let rt: THREE.WebGLRenderTarget | null = null;
    let alive = true;

    const apply = (texture: THREE.Texture) => {
      if (!alive) return;
      scene.environment = texture;
      scene.environmentIntensity = intensity;
    };

    if (hdri) {
      new RGBELoader().load(
        hdri,
        (tex) => {
          rt = pmrem.fromEquirectangular(tex);
          tex.dispose();
          apply(rt.texture);
        },
        undefined,
        () => {
          // HDRI topilmasa — studiyaga qaytamiz
          rt = pmrem.fromScene(new RoomEnvironment(), 0.04);
          apply(rt.texture);
        }
      );
    } else {
      rt = pmrem.fromScene(new RoomEnvironment(), 0.04);
      apply(rt.texture);
    }

    return () => {
      alive = false;
      scene.environment = null;
      rt?.dispose();
      pmrem.dispose();
    };
  }, [gl, scene, intensity, hdri]);

  return null;
}
