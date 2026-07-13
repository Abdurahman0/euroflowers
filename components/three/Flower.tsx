"use client";
import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useWind } from "./engine/WindController";
import { useFlowerAnimation } from "./engine/FlowerAnimationController";

/**
 * Protsedural premium gul — Flower Engine iste'molchisi.
 * Holatlar FlowerAnimationController'dan, shamol WindController'dan keladi.
 * Har bir gulbarg mustaqil harakatlanadi; hech narsa robotga o'xshamaydi.
 */

type FlowerProps = {
  position?: [number, number, number];
  scale?: number;
  petalColor?: string;
  petalEdgeColor?: string;
  centerColor?: string;
  stemColor?: string;
  /** 0..1 — tashqaridan boshqariladigan ochilish; berilmasa holat mashinasi sikllaydi */
  bloom?: number;
  /** true bo'lganda gulbarglar ohista uchib ketadi (login muvaffaqiyati) */
  flyAway?: boolean;
  autoCycle?: boolean;
  seed?: number;
  reducedMotion?: boolean;
};

/** Yumshoq egilgan gulbarg geometriyasi — uch tomonlama qayrilish bilan. */
function makePetalGeometry(width: number, length: number, curl: number, cup: number): THREE.BufferGeometry {
  const geo = new THREE.PlaneGeometry(1, 1, 8, 14);
  const pos = geo.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    const u = pos.getX(i) + 0.5;
    const v = pos.getY(i) + 0.5;
    const profile = Math.sin(Math.PI * Math.pow(v, 0.72)) * (0.62 + 0.38 * Math.sin(Math.PI * v));
    const x = (u - 0.5) * width * Math.max(profile, 0.04);
    const y = v * length;
    const z = curl * v * v * length - Math.pow(u - 0.5, 2) * cup * (1 - v * 0.55) + Math.sin(v * Math.PI) * 0.02;
    pos.setXYZ(i, x, y, z);
  }
  geo.computeVertexNormals();
  return geo;
}

type PetalDef = {
  ring: number;
  angle: number;
  openTilt: number;
  closedTilt: number;
  len: number;
  width: number;
  phase: number;
  delay: number;
  flyDir: THREE.Vector3;
};

const RING_BASE = [
  { len: 0.52, width: 0.34 },
  { len: 0.62, width: 0.4 },
  { len: 0.68, width: 0.46 },
];

export default function Flower({
  position = [0, 0, 0],
  scale = 1,
  petalColor = "#d98a94",
  petalEdgeColor = "#f3d7cf",
  centerColor = "#e8b96a",
  stemColor = "#4a7355",
  bloom,
  flyAway = false,
  autoCycle = true,
  seed = 1,
  reducedMotion = false,
}: FlowerProps) {
  const root = useRef<THREE.Group>(null);
  const head = useRef<THREE.Group>(null);
  const petalRefs = useRef<(THREE.Group | null)[]>([]);
  const petalMats = useRef<(THREE.MeshPhysicalMaterial | null)[]>([]);
  const fly = useRef(0);
  const wind = useWind();
  const anim = useFlowerAnimation({ autoCycle, seed });

  const rnd = useMemo(() => {
    let s = seed * 9301 + 49297;
    return () => {
      s = (s * 233280 + 9301) % 233280;
      return s / 233280;
    };
  }, [seed]);

  const petals = useMemo<PetalDef[]>(() => {
    const defs: PetalDef[] = [];
    const rings = [
      { count: 6, openTilt: 0.55 },
      { count: 8, openTilt: 0.95 },
      { count: 9, openTilt: 1.32 },
    ];
    rings.forEach((ring, ri) => {
      for (let i = 0; i < ring.count; i++) {
        const angle = (i / ring.count) * Math.PI * 2 + ri * 0.35 + rnd() * 0.14;
        defs.push({
          ring: ri,
          angle,
          openTilt: ring.openTilt + (rnd() - 0.5) * 0.16,
          closedTilt: 0.06 + ri * 0.05 + rnd() * 0.04,
          len: RING_BASE[ri].len * (0.94 + rnd() * 0.12),
          width: RING_BASE[ri].width * (0.92 + rnd() * 0.16),
          phase: rnd() * Math.PI * 2,
          delay: ri * 0.16 + (i / ring.count) * 0.1 + rnd() * 0.08,
          flyDir: new THREE.Vector3(Math.cos(angle), 0.9 + rnd() * 0.7, Math.sin(angle)).normalize(),
        });
      }
    });
    return defs;
  }, [rnd]);

  const petalGeos = useMemo(
    () => [
      makePetalGeometry(RING_BASE[0].width, RING_BASE[0].len, 0.55, 0.5),
      makePetalGeometry(RING_BASE[1].width, RING_BASE[1].len, 0.42, 0.42),
      makePetalGeometry(RING_BASE[2].width, RING_BASE[2].len, 0.3, 0.36),
    ],
    []
  );

  const stemCurve = useMemo(
    () =>
      new THREE.CatmullRomCurve3([
        new THREE.Vector3(0, -1.7, 0),
        new THREE.Vector3(0.05, -1.2, 0.03),
        new THREE.Vector3(-0.04, -0.6, -0.02),
        new THREE.Vector3(0.02, -0.1, 0.01),
        new THREE.Vector3(0, 0, 0),
      ]),
    []
  );

  const leafGeo = useMemo(() => makePetalGeometry(0.3, 0.55, 0.35, 0.25), []);

  useFrame((state, delta) => {
    const t = state.clock.elapsedTime;
    const dt = Math.min(delta, 0.05);
    const wd = wind.current;
    const windAmp = reducedMotion ? 0 : 0.5 + wd.strength + wd.gust * 1.4;

    const progress = anim.tick(dt, bloom);
    if (flyAway) fly.current = Math.min(fly.current + dt * 0.85, 1);

    // poya — global shamol × lokal o'lchovsiz sinuslar
    if (root.current && !reducedMotion) {
      const sway =
        (Math.sin(t * 0.5 + seed) * 0.028 +
          Math.sin(t * 0.233 + seed * 2.1) * 0.02 +
          Math.sin(t * 0.719 + seed * 4.4) * 0.011) * windAmp;
      root.current.rotation.z = sway + wd.cursorX * 0.015;
      root.current.rotation.x = (Math.sin(t * 0.341 + seed * 3.3) * 0.016 + Math.sin(t * 0.127 + seed) * 0.009) * windAmp;
    }
    // gul boshi nafas oladi
    if (head.current) {
      const breathe = reducedMotion ? 1 : 1 + Math.sin(t * 0.8 + seed) * 0.012;
      head.current.scale.setScalar(breathe);
    }

    petals.forEach((p, i) => {
      const g = petalRefs.current[i];
      if (!g) return;
      const local = THREE.MathUtils.clamp((progress - p.delay * 0.55) / (1 - p.delay * 0.5), 0, 1);
      const eased = local * local * (3 - 2 * local);
      let tilt = THREE.MathUtils.lerp(p.closedTilt, p.openTilt, eased);
      let twist = 0;
      if (!reducedMotion) {
        tilt += wd.sample(p.phase, t) * 0.032 * eased * windAmp * 0.6;
        twist = Math.sin(t * 0.6 + p.phase) * 0.05 * eased * windAmp * 0.5;
      }
      g.rotation.set(0, p.angle, 0);
      g.rotateX(tilt);
      g.rotateY(twist);

      if (fly.current > 0) {
        const f = fly.current * (0.7 + (i % 5) * 0.12);
        g.position.set(p.flyDir.x * f * 2.4, p.flyDir.y * f * 2.0, p.flyDir.z * f * 2.4);
        g.rotation.x += f * 3.2;
        g.rotation.z += f * 2.1;
        const m = petalMats.current[i];
        if (m) m.opacity = Math.max(1 - fly.current * 1.15, 0);
      } else {
        g.position.set(0, 0, 0);
      }
    });
  });

  return (
    <group position={position} scale={scale}>
      <group ref={root}>
        {/* poya */}
        <mesh>
          <tubeGeometry args={[stemCurve, 24, 0.028, 8]} />
          <meshStandardMaterial color={stemColor} roughness={0.7} />
        </mesh>
        {/* barglar */}
        {[0.55, 0.35].map((h, i) => (
          <group key={i} position={[0, -1.75 + h * 1.4, 0]} rotation={[0.9 + i * 0.3, i === 0 ? 0.6 : -2.2, 0]}>
            <mesh geometry={leafGeo} scale={i === 0 ? 0.9 : 0.7}>
              <meshStandardMaterial color={stemColor} roughness={0.65} side={THREE.DoubleSide} />
            </mesh>
          </group>
        ))}
        {/* gul boshi */}
        <group ref={head}>
          <mesh position={[0, 0.05, 0]}>
            <icosahedronGeometry args={[0.11, 2]} />
            <meshStandardMaterial color={centerColor} roughness={0.5} />
          </mesh>
          <mesh position={[0, 0.02, 0]}>
            <sphereGeometry args={[0.15, 16, 12]} />
            <meshStandardMaterial color={petalEdgeColor} roughness={0.8} />
          </mesh>
          {petals.map((p, i) => (
            <group key={i} ref={(el) => { petalRefs.current[i] = el; }}>
              <mesh geometry={petalGeos[p.ring]} scale={[p.width / RING_BASE[p.ring].width, p.len / RING_BASE[p.ring].len, 1]}>
                <meshPhysicalMaterial
                  ref={(m) => { petalMats.current[i] = m; }}
                  color={p.ring === 0 ? petalEdgeColor : petalColor}
                  roughness={0.55}
                  sheen={1}
                  sheenColor={petalEdgeColor}
                  sheenRoughness={0.4}
                  clearcoat={0.15}
                  side={THREE.DoubleSide}
                  transparent
                />
              </mesh>
            </group>
          ))}
        </group>
      </group>
    </group>
  );
}
