"use client";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { useGLTF, useAnimations } from "@react-three/drei";
import * as THREE from "three";
import Flower from "./Flower";
import { useWind } from "./engine/WindController";
import { useFlowerAnimation } from "./engine/FlowerAnimationController";
import { FLOWER_MODELS } from "./engine/assets";

/**
 * Fotorealistik gul: `public/flowers/models/` ichidagi Blender GLB'lari.
 * Ochilish (bloom) FlowerAnimationController orqali boshqariladi — gul sekin,
 * organik ochiladi; GLB ichida klip bo'lsa u ham ijro etiladi.
 * Model yuklanmasa premium protsedural gulga qaytadi — hech narsa buzilmaydi.
 */
const CANDIDATES = Object.values(FLOWER_MODELS);

type Props = {
  position?: [number, number, number];
  scale?: number;
  bloom?: number;
  flyAway?: boolean;
  autoCycle?: boolean;
  seed?: number;
  reducedMotion?: boolean;
  /** aniq model nomi (masalan "rose") — berilmasa birinchi topilgani */
  prefer?: string;
};

/** Sahna ~2 birlikli gulga mo'ljallangan — Blender modeli qanday masshtabda
 *  eksport qilinganidan qat'i nazar, bounding box orqali normallaymiz. */
const TARGET_HEIGHT = 2.2;

function GlbFlower({ url, position = [0, 0, 0], scale = 1, bloom, flyAway = false, autoCycle = false, seed = 1, reducedMotion = false }: Props & { url: string }) {
  const { scene, animations } = useGLTF(url);
  const ref = useRef<THREE.Group>(null);
  const { actions, names } = useAnimations(animations, ref);
  const fly = useRef(0);
  const wind = useWind();
  const anim = useFlowerAnimation({ autoCycle, seed });

  // model o'lchamini normallash: balandligi TARGET_HEIGHT, boshi guruh markazida
  const fit = useMemo(() => {
    const box = new THREE.Box3().setFromObject(scene);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    const k = TARGET_HEIGHT / Math.max(size.y, 1e-4);
    // gul boshi modelning yuqori qismida — uni guruh markaziga keltiramiz
    return { k, offset: new THREE.Vector3(-center.x * k, -(box.min.y + size.y * 0.78) * k, -center.z * k) };
  }, [scene]);

  // GLB ichidagi kliplar bo'lsa — hammasini yumshoq crossfade bilan ijro etamiz
  useEffect(() => {
    if (reducedMotion || names.length === 0) return;
    names.forEach((n, i) => {
      const a = actions[n];
      if (!a) return;
      a.reset();
      a.setLoop(THREE.LoopRepeat, Infinity);
      // har klip ozgina boshqa tezlikda — mexanik sinxronlik yo'qoladi
      a.timeScale = 0.85 + ((seed + i) % 5) * 0.08;
      a.fadeIn(1.2).play();
    });
    return () => {
      names.forEach((n) => actions[n]?.fadeOut(0.5));
    };
  }, [actions, names, seed, reducedMotion]);

  useFrame((state, delta) => {
    if (!ref.current) return;
    const t = state.clock.elapsedTime;
    const dt = Math.min(delta, 0.05);
    const wd = wind.current;

    // ochilish darajasi — holat mashinasidan (bloom tashqi nishon bo'lishi mumkin)
    const progress = anim.tick(dt, bloom);
    const eased = progress * progress * (3 - 2 * progress);
    const emerge = 0.24 + 0.76 * eased;

    if (!reducedMotion) {
      const amp = 0.5 + wd.strength + wd.gust * 1.2;
      // kliplar bo'lsa ham poya darajasidagi mayin chayqalish qo'shiladi
      ref.current.rotation.z = (Math.sin(t * 0.5 + seed) * 0.024 + Math.sin(t * 0.233 + seed * 2) * 0.016) * amp + wd.cursorX * 0.012;
      ref.current.rotation.y = Math.sin(t * 0.17 + seed) * 0.05 * amp;
      const breathe = 1 + Math.sin(t * 0.8 + seed) * 0.012;
      ref.current.scale.setScalar(scale * breathe * emerge);
    } else {
      ref.current.scale.setScalar(scale * emerge);
    }
    // g'unchaligida bosh biroz egilgan, ochilganda ko'tariladi
    ref.current.rotation.x = (1 - eased) * -0.28;
    ref.current.position.y = position[1] - (1 - eased) * 0.34;
    if (flyAway) {
      fly.current = Math.min(fly.current + delta * 0.8, 1);
      ref.current.position.y = position[1] + fly.current * 1.6;
      ref.current.traverse((o) => {
        const mesh = o as THREE.Mesh;
        if (mesh.isMesh) {
          const m = mesh.material as THREE.Material;
          m.transparent = true;
          m.opacity = Math.max(1 - fly.current * 1.2, 0);
        }
      });
    }
  });

  return (
    <group ref={ref} position={position} scale={scale}>
      <group position={fit.offset} scale={fit.k}>
        <primitive object={scene} />
      </group>
    </group>
  );
}

export default function RealisticFlower(props: Props) {
  const [glb, setGlb] = useState<string | null>(null);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    let alive = true;
    const list = props.prefer
      ? [`/flowers/models/${props.prefer}.glb`, ...CANDIDATES]
      : CANDIDATES;
    (async () => {
      for (const url of list) {
        try {
          const r = await fetch(url, { method: "HEAD" });
          const ct = r.headers.get("content-type") ?? "";
          if (r.ok && !ct.includes("text/html")) {
            if (alive) setGlb(url);
            break;
          }
        } catch {
          /* keyingisini tekshiramiz */
        }
      }
      if (alive) setChecked(true);
    })();
    return () => { alive = false; };
  }, [props.prefer]);

  if (!checked) return null;
  if (glb) {
    return (
      <Suspense fallback={<Flower {...props} />}>
        <GlbFlower {...props} url={glb} />
      </Suspense>
    );
  }
  return <Flower {...props} />;
}

useGLTF.preload(FLOWER_MODELS.white);
