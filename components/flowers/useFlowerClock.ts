"use client";
import { useEffect, useState } from "react";
import type { FlowerPhase } from "./FlowerAnimation";

/**
 * Gul soati — foydalanuvchining mahalliy vaqti bo'yicha faza:
 *   00–06 yopiq · 06–09 ochilmoqda · 09–18 to'liq ochiq ·
 *   18–21 yopilmoqda · 21–24 yopiq.
 * `progress` — o'tish fazasining qanchasi o'tgani (0..1); sahifa faza o'rtasida
 * ochilsa, klip boshidan emas, mos joyidan davom etadi.
 */
export function flowerPhaseNow(d = new Date()): { phase: FlowerPhase; progress: number } {
  const h = d.getHours() + d.getMinutes() / 60 + d.getSeconds() / 3600;
  if (h < 6) return { phase: "closed", progress: 0 };
  if (h < 9) return { phase: "opening", progress: (h - 6) / 3 };
  if (h < 18) return { phase: "bloomed", progress: 0 };
  if (h < 21) return { phase: "closing", progress: (h - 18) / 3 };
  return { phase: "closed", progress: 0 };
}

export function useFlowerClock(pollMs = 30000): { phase: FlowerPhase; progress: number } {
  const [state, setState] = useState(() => flowerPhaseNow());

  useEffect(() => {
    const t = setInterval(() => {
      const next = flowerPhaseNow();
      setState((prev) => (prev.phase === next.phase ? prev : next));
    }, pollMs);
    return () => clearInterval(t);
  }, [pollMs]);

  return state;
}
