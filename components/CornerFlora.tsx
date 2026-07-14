"use client";
import { FLOWER_PHOTOS } from "@/components/three/engine/assets";

/**
 * Burchak gullari — haqiqiy piyon suratlari, juda sekin nafas oladi.
 * Sahifa hech qachon to'liq to'xtab qolmaydi, lekin ko'zga tashlanmaydi.
 * Parallaks chuqurligi bilan kontentdan orqada suzadi.
 */
export default function CornerFlora() {
  return (
    <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden" aria-hidden>
      <div
        className="absolute -right-14 -top-14 opacity-[.15]"
        style={{
          animation: "floraBreath 13s ease-in-out infinite",
          transform: "translate3d(calc(var(--plx-x, 0px) * 4), calc(var(--plx-y, 0px) * 4), 0)",
          willChange: "transform",
        }}
      >
        <img src={FLOWER_PHOTOS.peony} alt="" width={210} height={210} style={{ filter: "saturate(0.92)" }} />
      </div>
      <div
        className="absolute -bottom-16 -left-14 opacity-[.13]"
        style={{
          animation: "floraBreath 17s ease-in-out infinite reverse",
          transform: "translate3d(calc(var(--plx-x, 0px) * 6), calc(var(--plx-y, 0px) * 6), 0)",
          willChange: "transform",
        }}
      >
        <img src={FLOWER_PHOTOS.pinkRose} alt="" width={250} height={250} style={{ filter: "saturate(0.9)" }} />
      </div>
      <style jsx>{`
        @keyframes floraBreath {
          0%, 100% { scale: 1; rotate: 0deg; }
          50% { scale: 1.05; rotate: 3deg; }
        }
      `}</style>
    </div>
  );
}
