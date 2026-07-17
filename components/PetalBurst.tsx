"use client";
import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { PETAL_TEXTURES } from "@/components/three/engine/assets";

/**
 * Har 11–24 soniyada bir dasta gulbarg ekran bo'ylab tabiiy uchib o'tadi.
 * Gulbarglar — Blender'dan chiqarilgan haqiqiy piyon gulbarg teksturalari,
 * organik siluet niqobida. Fasl palitrasiga ergashadi. Takrorlanmaydi.
 */

type Petal = {
  id: number;
  y: string;
  size: number;
  dur: number;
  delay: number;
  opacity: number;
  spin: number;
  wave: number;
  tex: string;
  shape: string;
};

/** fasl materiallari → chiqartirilgan tekstura fayllari */
const MAT_TO_TEX: Record<string, string> = {
  Petal_white: PETAL_TEXTURES.white,
  Petal_cream: PETAL_TEXTURES.cream,
  Petal_blush: PETAL_TEXTURES.blush,
  Petal_pink: PETAL_TEXTURES.pink,
  Petal_rose: PETAL_TEXTURES.rose,
  Petal_red: PETAL_TEXTURES.red,
};

/** har gulbargga ozgina boshqacha organik siluet */
const SHAPES = [
  "76% 14% 82% 12% / 66% 22% 78% 18%",
  "82% 10% 74% 16% / 72% 16% 70% 24%",
  "70% 20% 84% 10% / 62% 26% 80% 14%",
];

export default function PetalBurst() {
  const [petals, setPetals] = useState<Petal[]>([]);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let timer: ReturnType<typeof setTimeout>;
    let id = 0;
    const schedule = () => {
      timer = setTimeout(() => {
        const texes = [PETAL_TEXTURES.white, PETAL_TEXTURES.blush, PETAL_TEXTURES.cream, PETAL_TEXTURES.pink];
        const count = 8 + Math.floor(Math.random() * 7);
        setPetals(
          Array.from({ length: count }, () => ({
            id: id++,
            y: `${8 + Math.random() * 70}%`,
            size: 14 + Math.random() * 22,
            dur: 9 + Math.random() * 8,
            delay: Math.random() * 2.5,
            opacity: 0.12 + Math.random() * 0.14,
            spin: (Math.random() - 0.5) * 720,
            wave: 30 + Math.random() * 90,
            tex: texes[Math.floor(Math.random() * texes.length)] ?? PETAL_TEXTURES.blush,
            shape: SHAPES[Math.floor(Math.random() * SHAPES.length)],
          }))
        );
        setNonce((n) => n + 1);
        schedule();
      }, 11000 + Math.random() * 13000);
    };
    schedule();
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="pointer-events-none fixed inset-0 z-[60] overflow-hidden" aria-hidden>
      <AnimatePresence>
        {petals.map((p) => (
          <motion.div
            key={`${nonce}-${p.id}`}
            initial={{ x: "-6vw", y: 0, rotate: 0, opacity: 0 }}
            animate={{
              x: "108vw",
              y: [0, -p.wave, p.wave * 0.6, -p.wave * 0.4, 0],
              rotate: p.spin,
              opacity: [0, p.opacity, p.opacity, p.opacity * 0.8, 0],
            }}
            exit={{ opacity: 0 }}
            transition={{ duration: p.dur, delay: p.delay, ease: "linear", times: [0, 0.25, 0.5, 0.75, 1] }}
            onAnimationComplete={() => setPetals((ps) => ps.filter((x) => x.id !== p.id))}
            className="absolute"
            style={{
              top: p.y,
              width: p.size,
              height: p.size * 1.25,
              backgroundImage: `url(${p.tex})`,
              backgroundSize: "cover",
              borderRadius: p.shape,
              boxShadow: "inset 0 0 6px rgba(120,60,60,0.18)",
            }}
          />
        ))}
      </AnimatePresence>
    </div>
  );
}
