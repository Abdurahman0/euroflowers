"use client";
import { useState } from "react";
import { PETAL_TEXTURES } from "@/components/three/engine/assets";
import { isLowEnd } from "@/lib/perf";

/**
 * Yuqoridan tushayotgan gulbarglar — ilgari 3D RealPetals bajarardi,
 * endi arzon DOM qatlami: faqat transform+opacity CSS animatsiyalari,
 * kadr sayin JS yo'q. Manfiy delay bilan maydon darhol to'la ko'rinadi.
 * Tab yashirilganda .app-hidden pauza qiladi; reduced-motion'da global
 * qoida o'chiradi; kuchsiz qurilmada soni kamayadi. Rang --petal-tint
 * tokeniga ergashadi (tunda chuqurroq atirgul tusi).
 */

type P = {
  left: number; size: number; fall: number; delay: number;
  sway: number; swayDur: number; spin: number; op: number;
  tex: string; shape: string;
};

const SHAPES = [
  "76% 14% 82% 12% / 66% 22% 78% 18%",
  "82% 10% 74% 16% / 72% 16% 70% 24%",
  "70% 20% 84% 10% / 62% 26% 80% 14%",
];

function makePetals(count: number): P[] {
  const texes = [PETAL_TEXTURES.white, PETAL_TEXTURES.blush, PETAL_TEXTURES.cream, PETAL_TEXTURES.pink, PETAL_TEXTURES.rose];
  return Array.from({ length: count }, () => {
    const fall = 13 + Math.random() * 13; // 13–26s — sekin, osoyishta
    return {
      left: Math.random() * 100,
      size: 12 + Math.random() * 14,
      fall,
      delay: -Math.random() * fall, // manfiy: ekran boshidanoq to'la
      sway: 18 + Math.random() * 42,
      swayDur: 2.6 + Math.random() * 2.8,
      spin: 4 + Math.random() * 5,
      op: 0.3 + Math.random() * 0.28,
      tex: texes[Math.floor(Math.random() * texes.length)] ?? PETAL_TEXTURES.blush,
      shape: SHAPES[Math.floor(Math.random() * SHAPES.length)] ?? SHAPES[0],
    };
  });
}

export default function FallingPetals() {
  // bir marta, faqat klientda (ssr:false zanjirida) — gidratsiya mos kelmasligi yo'q
  const [petals] = useState(() => makePetals(isLowEnd() ? 8 : 16));

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      {petals.map((p, i) => (
        <span
          key={i}
          className="petal-fall absolute block"
          style={{
            left: `${p.left}%`,
            top: "-6vh",
            width: p.size,
            height: p.size * 1.25,
            opacity: p.op,
            animationDuration: `${p.fall}s`,
            animationDelay: `${p.delay}s`,
          }}
        >
          <span
            className="petal-sway block h-full w-full"
            style={{
              backgroundImage: `url(${p.tex})`,
              backgroundSize: "cover",
              borderRadius: p.shape,
              boxShadow: "inset 0 0 5px var(--petal-shadow)",
              filter: "var(--petal-tint)",
              animationDuration: `${p.swayDur}s, ${p.spin}s`,
              animationDelay: `${p.delay}s, ${p.delay}s`,
              ["--sway-x" as string]: `${p.sway}px`,
            }}
          />
        </span>
      ))}
      <style jsx global>{`
        .petal-fall {
          animation-name: petalFall;
          animation-timing-function: linear;
          animation-iteration-count: infinite;
          will-change: transform;
        }
        .petal-sway {
          animation-name: petalSway, petalSpin;
          animation-timing-function: ease-in-out, linear;
          animation-iteration-count: infinite, infinite;
          animation-direction: alternate, normal;
        }
        @keyframes petalFall {
          from { transform: translate3d(0, 0, 0); }
          to { transform: translate3d(0, 118vh, 0); }
        }
        @keyframes petalSway {
          from { translate: calc(var(--sway-x, 30px) * -1) 0; }
          to { translate: var(--sway-x, 30px) 0; }
        }
        @keyframes petalSpin {
          from { rotate: 0deg; }
          to { rotate: 360deg; }
        }
      `}</style>
    </div>
  );
}
