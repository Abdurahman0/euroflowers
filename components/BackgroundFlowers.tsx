"use client";
import { useTheme } from "@/lib/store";

/**
 * Fon: real gul PNG'lari (public/flowers/) chayqalish/aylanish animatsiyasi bilan,
 * oq nur dog'lari va tushayotgan gul barglari.
 * PNG topilmasa element bo'sh qoladi — layout buzilmaydi.
 */
const Petal = () => (
  <svg viewBox="0 0 40 40" width="100%" height="100%" fill="currentColor">
    <path d="M20,38 C6,30 2,14 12,6 C18,1 28,2 32,10 C36,20 32,32 20,38 Z" />
  </svg>
);

export default function BackgroundFlowers() {
  const { dark } = useTheme();
  const op = (l: number, d: number) => (dark ? d : l);
  const glow = { filter: "drop-shadow(0 0 34px rgba(255,255,255,.8))" };

  return (
    <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
      {/* gullar */}
      <img src="/flowers/peony.png" alt="" className="absolute right-[-40px] top-[12%] w-[340px] animate-sway origin-bottom" style={{ opacity: op(0.55, 0.42), ...glow }} />
      <img src="/flowers/pink-rose.png" alt="" className="absolute left-[30%] top-[2%] w-[280px] animate-spin-slow" style={{ opacity: op(0.5, 0.4), ...glow }} />
      <img src="/flowers/hydrangea-pink.png" alt="" className="absolute bottom-[-40px] left-[22%] w-[330px] animate-sway origin-bottom" style={{ opacity: op(0.6, 0.45), ...glow }} />
      <img src="/flowers/hydrangea-white.png" alt="" className="absolute bottom-[-40px] left-[48%] w-[270px] animate-sway origin-bottom" style={{ opacity: op(0.55, 0.4), animationDuration: "19s", ...glow }} />
      <img src="/flowers/hydrangea-blue.png" alt="" className="absolute bottom-[-30px] right-[6%] w-[300px] animate-sway origin-bottom" style={{ opacity: op(0.55, 0.4), animationDuration: "21s", ...glow }} />

      {/* oq nur dog'lari */}
      <div className="absolute left-[12%] top-[8%] h-[340px] w-[340px] rounded-full blur-[30px]" style={{ background: `radial-gradient(circle, rgba(255,255,255,${op(0.55, 0.1)}), transparent 68%)` }} />
      <div className="absolute right-[16%] top-[48%] h-[300px] w-[300px] rounded-full blur-[34px]" style={{ background: `radial-gradient(circle, rgba(255,255,255,${op(0.45, 0.08)}), transparent 68%)` }} />
      <div className="absolute bottom-[6%] left-[8%] h-[280px] w-[280px] rounded-full blur-[30px]" style={{ background: `radial-gradient(circle, rgba(255,255,255,${op(0.5, 0.08)}), transparent 68%)` }} />

      {/* tushayotgan barglar */}
      {[
        { left: "14%", w: 34, dur: 26, delay: 0 },
        { left: "38%", w: 26, dur: 34, delay: 9 },
        { left: "62%", w: 30, dur: 30, delay: 17 },
        { left: "84%", w: 22, dur: 40, delay: 5 },
      ].map((p, i) => (
        <div
          key={i}
          className="absolute top-[-70px] animate-drift"
          style={{ left: p.left, width: p.w, height: p.w, color: "var(--acc)", opacity: 0.2, animationDuration: `${p.dur}s`, animationDelay: `${p.delay}s` }}
        >
          <Petal />
        </div>
      ))}
    </div>
  );
}
