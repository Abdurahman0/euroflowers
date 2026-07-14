"use client";
import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { FALLING_PETALS } from "./assets";

/**
 * Gulbarg qo'yib yuborish — muvaffaqiyat lahzasi: gul boshidan haqiqiy Blender
 * gulbarglari ohista ko'tarilib, aylanib tarqaladi va so'nadi.
 * `active` true bo'lganda bir marta ijro etiladi.
 */

const COUNT = 20;

const rnd = (i: number, salt: number) => {
  const v = Math.sin(i * 91.7 + salt * 271.3) * 43758.5453;
  return v - Math.floor(v);
};

export default function PetalRelease({
  active,
  position = [0, 1.05, 0],
}: {
  active: boolean;
  position?: [number, number, number];
}) {
  const { scene } = useGLTF(FALLING_PETALS);
  const mesh = useRef<THREE.InstancedMesh>(null);
  const progress = useRef(0);
  const dummy = useMemo(() => new THREE.Object3D(), []);

  const { geo, mat, norm } = useMemo(() => {
    let source: THREE.Mesh | null = null;
    scene.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh && !source && (m.material as THREE.Material).name === "Petal_blush") source = m;
    });
    if (!source) {
      scene.traverse((o) => {
        const m = o as THREE.Mesh;
        if (m.isMesh && !source) source = m;
      });
    }
    const src = source as THREE.Mesh | null;
    const material = (src!.material as THREE.MeshStandardMaterial).clone();
    material.transparent = true;
    material.depthWrite = false;
    material.side = THREE.DoubleSide;
    src!.geometry.computeBoundingBox();
    const bb = src!.geometry.boundingBox!;
    const maxDim = Math.max(bb.max.x - bb.min.x, bb.max.y - bb.min.y, bb.max.z - bb.min.z);
    return { geo: src!.geometry, mat: material, norm: 0.3 / Math.max(maxDim, 1e-4) };
  }, [scene]);

  useEffect(() => () => mat.dispose(), [mat]);

  const seeds = useMemo(
    () =>
      Array.from({ length: COUNT }, (_, i) => {
        const ang = rnd(i, 1) * Math.PI * 2;
        return {
          dir: new THREE.Vector3(Math.cos(ang) * (0.5 + rnd(i, 2)), 0.8 + rnd(i, 3) * 1.1, Math.sin(ang) * (0.5 + rnd(i, 2))).normalize(),
          speed: 0.9 + rnd(i, 4) * 1.4,
          delay: rnd(i, 5) * 0.35,
          rot: new THREE.Euler(rnd(i, 6) * Math.PI * 2, rnd(i, 7) * Math.PI * 2, rnd(i, 8) * Math.PI * 2),
          tumble: 2 + rnd(i, 9) * 4,
          scale: 0.5 + rnd(i, 10) * 0.7,
        };
      }),
    []
  );

  useFrame((_, delta) => {
    if (!mesh.current) return;
    if (active) progress.current = Math.min(progress.current + delta * 0.42, 1);
    const p = progress.current;
    mesh.current.visible = p > 0.001;
    if (!mesh.current.visible) return;

    seeds.forEach((s, i) => {
      const lp = THREE.MathUtils.clamp((p - s.delay) / (1 - s.delay), 0, 1);
      const ease = 1 - Math.pow(1 - lp, 2.2);
      const d = ease * s.speed * 2.6;
      dummy.position.set(
        position[0] + s.dir.x * d,
        position[1] + s.dir.y * d - lp * lp * 0.5,
        position[2] + s.dir.z * d
      );
      dummy.rotation.set(s.rot.x + lp * s.tumble, s.rot.y + lp * s.tumble * 0.7, s.rot.z + lp * s.tumble * 0.5);
      dummy.scale.setScalar(s.scale * norm * (lp < 0.08 ? lp / 0.08 : 1) * (1 - Math.pow(lp, 3)));
      dummy.updateMatrix();
      mesh.current!.setMatrixAt(i, dummy.matrix);
    });
    mat.opacity = 1 - Math.pow(p, 2.4);
    mesh.current.instanceMatrix.needsUpdate = true;
  });

  return <instancedMesh ref={mesh} args={[geo, mat, COUNT]} frustumCulled={false} visible={false} />;
}

useGLTF.preload(FALLING_PETALS);
