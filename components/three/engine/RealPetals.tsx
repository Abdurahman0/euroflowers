"use client";
import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { useWind } from "./WindController";
import { FALLING_PETALS } from "./assets";

/**
 * Haqiqiy gulbarg emitteri — falling_petals.glb (Blender) ichidagi 30 ta gulbarg
 * geometriyasi va 6 ta PBR materialidan quriladi. Har material uchun bir nechta
 * InstancedMesh: shakl xilma-xilligi + instansiyalash tezligi birga.
 *
 * Har instansiya o'z tezligi, aylanishi, yo'nalishi, o'lchami, chuqurligi va
 * tug'ilish fazasiga ega — naqsh hech qachon takrorlanmaydi. Ba'zilari kameraga
 * juda yaqin o'tadi, ba'zilari uzoqda qoladi. Fasl almashganda guruhlar ohista
 * so'nib/paydo bo'lib almashadi (scale-lerp) — hech qanday sakrash yo'q.
 */

const VARIANTS_PER_MATERIAL = 2;
/** doimiy nafis palitra — oq, pushti-oq, krem, pushti */
const ACTIVE_PETALS: string[] = ["Petal_white", "Petal_blush", "Petal_cream", "Petal_pink"];

type Unit = {
  matName: string;
  geo: THREE.BufferGeometry;
  mat: THREE.MeshStandardMaterial;
  /** geometriyani ~0.34 birlik gulbargga normallovchi koeffitsient */
  norm: number;
  capacity: number;
  seeds: {
    x: number;
    speed: number;
    drift: number;
    dir: number;
    rot: THREE.Euler;
    rotSpeed: THREE.Vector3;
    scale: number;
    phase: number;
    z: number;
    windK: number;
    op: number;
  }[];
};

/** deterministik pseudo-random — SSR va resume xavfsiz */
const rnd = (i: number, salt: number) => {
  const v = Math.sin(i * 127.1 + salt * 311.7) * 43758.5453;
  return v - Math.floor(v);
};

export default function RealPetals({
  count = 48,
  near = true,
  opacity = 0.92,
  area = 1.15,
  reducedMotion = false,
}: {
  /** o'rtacha ko'rinadigan gulbarg soni (fasl zichligi bilan ko'payadi/kamayadi) */
  count?: number;
  /** ba'zi gulbarglar kameraga yaqin o'tadimi */
  near?: boolean;
  opacity?: number;
  area?: number;
  reducedMotion?: boolean;
}) {
  const { scene } = useGLTF(FALLING_PETALS);
  const { viewport, camera } = useThree();
  const wind = useWind();
  const meshRefs = useRef<(THREE.InstancedMesh | null)[]>([]);
  const activity = useRef<Map<string, number>>(new Map());
  const speedK = useRef(1);
  const dummy = useMemo(() => new THREE.Object3D(), []);

  const units = useMemo<Unit[]>(() => {
    const byMat = new Map<string, THREE.Mesh[]>();
    scene.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      const name = (m.material as THREE.Material).name;
      if (!byMat.has(name)) byMat.set(name, []);
      byMat.get(name)!.push(m);
    });

    const mats = Array.from(byMat.keys());
    const perUnit = Math.max(3, Math.ceil((count * 1.7) / (mats.length * VARIANTS_PER_MATERIAL)));
    const out: Unit[] = [];
    mats.forEach((matName, mi) => {
      const meshes = byMat.get(matName)!;
      for (let v = 0; v < Math.min(VARIANTS_PER_MATERIAL, meshes.length); v++) {
        const src = meshes[Math.floor((v / VARIANTS_PER_MATERIAL) * meshes.length)];
        const mat = (src.material as THREE.MeshStandardMaterial).clone();
        mat.transparent = true;
        mat.opacity = 0;
        mat.depthWrite = false;
        mat.side = THREE.DoubleSide;
        src.geometry.computeBoundingBox();
        const bb = src.geometry.boundingBox!;
        const maxDim = Math.max(bb.max.x - bb.min.x, bb.max.y - bb.min.y, bb.max.z - bb.min.z);
        const salt = mi * 7 + v * 13 + 1;
        out.push({
          matName,
          geo: src.geometry,
          mat,
          norm: 0.34 / Math.max(maxDim, 1e-4),
          capacity: perUnit,
          seeds: Array.from({ length: perUnit }, (_, i) => {
            const isNear = near && rnd(i, salt + 5) < 0.08;
            return {
              x: rnd(i, salt),
              speed: 0.07 + rnd(i, salt + 1) * 0.2,
              drift: (rnd(i, salt + 2) - 0.5) * 0.9,
              dir: rnd(i, salt + 11) < 0.5 ? -1 : 1,
              rot: new THREE.Euler(rnd(i, salt + 3) * Math.PI * 2, rnd(i, salt + 4) * Math.PI * 2, rnd(i, salt + 12) * Math.PI * 2),
              rotSpeed: new THREE.Vector3(
                (0.25 + rnd(i, salt + 6) * 0.9) * (rnd(i, salt + 13) < 0.5 ? -1 : 1),
                0.2 + rnd(i, salt + 7) * 0.7,
                (0.2 + rnd(i, salt + 14) * 0.8) * (rnd(i, salt + 15) < 0.5 ? -1 : 1)
              ),
              scale: isNear ? 0.95 + rnd(i, salt + 8) * 0.7 : 0.55 + rnd(i, salt + 8) * 0.9,
              phase: rnd(i, salt + 9) * 120,
              z: isNear ? 0.2 + rnd(i, salt + 10) * 1.2 : -1.4 - rnd(i, salt + 10) * 4.6,
              windK: 0.5 + rnd(i, salt + 16),
              op: 0.55 + rnd(i, salt + 17) * 0.45,
            };
          }),
        });
      }
    });
    return out;
  }, [scene, count, near]);

  // klonlangan materiallarni bo'shatamiz (geometriya GLB keshiga tegishli)
  useEffect(() => {
    return () => units.forEach((u) => u.mat.dispose());
  }, [units]);

  useFrame((state, delta) => {
    const t = reducedMotion ? 0 : state.clock.elapsedTime;
    const k = 1 - Math.exp(-delta * 1.4);
    const density = 1;
    const wd = wind.current;
    const camZ = (camera as THREE.PerspectiveCamera).position.z || 6;
    const w = Math.max(viewport.width, 10);
    const h = Math.max(viewport.height, 7);
    const windPush = reducedMotion ? 0 : (wd.strength + wd.gust * 0.8) * Math.cos(wd.direction) + wd.cursorX;

    units.forEach((u, ui) => {
      const mesh = meshRefs.current[ui];
      if (!mesh) return;
      // fasl guruhi faolligi — ohista kirib-chiqadi
      const want = ACTIVE_PETALS.includes(u.matName) ? 1 : 0;
      const cur = activity.current.get(u.matName + ui) ?? want;
      const act = cur + (want - cur) * k;
      activity.current.set(u.matName + ui, act);
      u.mat.opacity = opacity * Math.min(act * 1.4, 1);
      if (act < 0.015) {
        mesh.count = 0;
        return;
      }
      const visible = Math.max(1, Math.round(u.capacity * Math.min(density, 1.7) * 0.72));
      mesh.count = Math.min(visible, u.capacity);

      for (let i = 0; i < mesh.count; i++) {
        const s = u.seeds[i];
        // chuqurlikka mos kenglik — yaqin gulbarglar kadr chetidan kirib chiqadi
        const spread = Math.max((camZ - s.z) / camZ, 0.25);
        const life = ((t * s.speed * speedK.current + s.phase) % 1.35) / 1.35;
        const y = h * 0.62 - life * h * 1.25;
        const x =
          (s.x - 0.5) * w * area * spread +
          Math.sin(t * 0.35 + s.phase) * s.drift * 2.2 * s.dir +
          windPush * s.windK * (0.7 + s.scale * 0.8);
        dummy.position.set(x, y, s.z);
        dummy.rotation.set(
          s.rot.x + t * s.rotSpeed.x * (0.6 + wd.gust * 0.5),
          s.rot.y + t * s.rotSpeed.y,
          s.rot.z + t * s.rotSpeed.z * 0.8
        );
        // chetlarda mayin kichrayish — shaffoflik o'zgarishi taassuroti
        const edgeFade = Math.min(1, 4 * Math.min(life, 1 - life) + 0.22);
        dummy.scale.setScalar(s.scale * u.norm * s.op * edgeFade * act);
        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);
      }
      mesh.instanceMatrix.needsUpdate = true;
    });
  });

  return (
    <>
      {units.map((u, i) => (
        <instancedMesh
          key={`${u.matName}-${i}`}
          ref={(el) => {
            meshRefs.current[i] = el;
          }}
          args={[u.geo, u.mat, u.capacity]}
          frustumCulled={false}
        />
      ))}
    </>
  );
}

useGLTF.preload(FALLING_PETALS);
