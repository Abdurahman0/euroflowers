"use client";
import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

/**
 * Har 20–40 soniyada bir necha gulbarg ekran bo'ylab tabiiy uchib o'tadi.
 * Har biri o'z tezligi, o'lchami, aylanishi va shaffofligi bilan — takrorlanmaydi.
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
};

const PetalShape = ({ fill }: { fill: string }) => (
  <svg viewBox="0 0 40 40" width="100%" height="100%" fill={fill}>
    <path d="M20,38 C6,30 2,14 12,6 C18,1 28,2 32,10 C36,20 32,32 20,38 Z" />
  </svg>
);

export default function PetalBurst() {
  const [petals, setPetals] = useState<Petal[]>([]);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let timer: ReturnType<typeof setTimeout>;
    let id = 0;
    const schedule = () => {
      timer = setTimeout(() => {
        const count = 4 + Math.floor(Math.random() * 5);
        setPetals(
          Array.from({ length: count }, () => ({
            id: id++,
            y: `${8 + Math.random() * 70}%`,
            size: 14 + Math.random() * 22,
            dur: 9 + Math.random() * 8,
            delay: Math.random() * 2.5,
            opacity: 0.18 + Math.random() * 0.3,
            spin: (Math.random() - 0.5) * 720,
            wave: 30 + Math.random() * 90,
          }))
        );
        setNonce((n) => n + 1);
        schedule();
      }, 20000 + Math.random() * 20000);
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
            style={{ top: p.y, width: p.size, height: p.size, color: "var(--acc)" }}
          >
            <PetalShape fill="var(--accL)" />
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
