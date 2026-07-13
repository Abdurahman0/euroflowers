"use client";
import { createContext, useContext, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";

/**
 * Shamol dvigateli — butun sahna uchun yagona, sekin evolyutsiya qiluvchi shamol.
 * Fraktal (ko'p oktavali, o'lchovsiz chastotali) sinuslar — hech qachon bir xil
 * takrorlanmaydi. Kursor harakati mayin qo'shimcha shabada beradi.
 *
 * Iste'molchilar `useWind()` orqali ref oladi va o'z useFrame'ida o'qiydi —
 * hech qanday re-render yo'q.
 */

export type WindState = {
  /** umumiy kuch 0..1 (sekin o'zgaradi) */
  strength: number;
  /** yo'nalish (radian, XZ tekisligida) */
  direction: number;
  /** qisqa muddatli shiddat (gust) 0..1 */
  gust: number;
  /** kursor ta'siri -1..1 */
  cursorX: number;
  /** t vaqtida lokal tebranish olish uchun yordamchi */
  sample: (phase: number, t: number) => number;
};

const defaultSample = (phase: number, t: number) =>
  Math.sin(t * 0.9 + phase) * 0.5 + Math.sin(t * 0.37 + phase * 2.3) * 0.3 + Math.sin(t * 1.31 + phase * 0.7) * 0.2;

const createWindState = (): WindState => ({
  strength: 0.5,
  direction: 0,
  gust: 0,
  cursorX: 0,
  sample: defaultSample,
});

const WindContext = createContext<React.MutableRefObject<WindState> | null>(null);

export function useWind(): React.MutableRefObject<WindState> {
  const ctx = useContext(WindContext);
  const fallback = useRef<WindState>(createWindState());
  return ctx ?? fallback;
}

export default function WindController({
  children,
  base = 0.5,
  cursorInfluence = 0.6,
  reducedMotion = false,
}: {
  children: React.ReactNode;
  /** o'rtacha shamol kuchi 0..1 */
  base?: number;
  cursorInfluence?: number;
  reducedMotion?: boolean;
}) {
  const wind = useRef<WindState>(createWindState());

  useFrame(({ clock, pointer }, delta) => {
    const t = clock.elapsedTime;
    const w = wind.current;
    if (reducedMotion) {
      w.strength = 0;
      w.gust = 0;
      w.cursorX = 0;
      return;
    }
    // sekin nafas oluvchi asosiy kuch (davri ~1.5–3 daqiqa oralig'ida suzadi)
    w.strength = base * (0.65 + 0.35 * Math.sin(t * 0.023) * Math.sin(t * 0.0071 + 2.1));
    // vaqti-vaqti bilan keluvchi shiddat to'lqini
    const g = Math.sin(t * 0.061) * Math.sin(t * 0.147 + 1.3) * Math.sin(t * 0.311 + 4.2);
    w.gust = Math.max(g, 0) * 0.9;
    // yo'nalish juda sekin aylanadi
    w.direction = Math.sin(t * 0.011) * Math.PI * 0.4;
    // kursor shabadasi — ohista quvib boradi
    w.cursorX += (pointer.x * cursorInfluence - w.cursorX) * (1 - Math.exp(-delta * 1.4));
  });

  return <WindContext.Provider value={wind}>{children}</WindContext.Provider>;
}
