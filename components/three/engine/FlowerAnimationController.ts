"use client";
import { useRef } from "react";

/**
 * Gul holat mashinasi: g'uncha → o'sish → ochilish → tin olish → shamol →
 * yopilish → qayta ochilish. Har kadrda `tick(dt)` chaqiriladi,
 * `progress` (0..1 ochilish darajasi) va joriy holat qaytadi.
 *
 * Protsedural gul ham, GLB gul ham bitta kontrollerdan boshqariladi.
 */

export type FlowerState = "bud" | "growing" | "bloom" | "idle" | "wind" | "close";

export type FlowerAnimation = {
  /** joriy silliqlangan ochilish darajasi 0..1 */
  progress: number;
  state: FlowerState;
  tick: (dt: number, externalTarget?: number) => number;
};

/** Sikl xronometrajı (soniya): har gul uchun seed bilan ozgina siljiydi. */
const PHASES: { state: FlowerState; dur: number; target: number }[] = [
  { state: "bud", dur: 1.6, target: 0.08 },
  { state: "growing", dur: 2.4, target: 0.45 },
  { state: "bloom", dur: 3.2, target: 1 },
  { state: "idle", dur: 7, target: 1 },
  { state: "wind", dur: 5, target: 0.97 },
  { state: "close", dur: 3.6, target: 0.08 },
];

export function useFlowerAnimation({
  autoCycle = true,
  seed = 1,
  speed = 1,
}: {
  autoCycle?: boolean;
  seed?: number;
  speed?: number;
} = {}): FlowerAnimation {
  const anim = useRef<FlowerAnimation | null>(null);

  if (!anim.current) {
    let cycleT = (seed * 3.7) % 6; // gullar bir xil fazada boshlamaydi
    const total = PHASES.reduce((a, p) => a + p.dur, 0);
    const self: FlowerAnimation = {
      progress: 0.08,
      state: "bud",
      tick(dt: number, externalTarget?: number) {
        let target: number;
        if (externalTarget != null) {
          target = externalTarget;
          self.state = externalTarget > 0.6 ? "bloom" : externalTarget > 0.2 ? "growing" : "bud";
        } else if (autoCycle) {
          cycleT = (cycleT + dt * speed) % total;
          let acc = 0;
          let phase = PHASES[0];
          for (const p of PHASES) {
            acc += p.dur;
            if (cycleT < acc) { phase = p; break; }
          }
          self.state = phase.state;
          target = phase.target;
        } else {
          target = 1;
          self.state = "idle";
        }
        // organik spring — ochilish tez emas, yopilish yumshoqroq
        const rate = target > self.progress ? 1.1 : 0.75;
        self.progress += (target - self.progress) * (1 - Math.exp(-dt * rate));
        return self.progress;
      },
    };
    anim.current = self;
  }
  return anim.current;
}
