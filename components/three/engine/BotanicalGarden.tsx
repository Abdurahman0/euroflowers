"use client";
import dynamic from "next/dynamic";
import { usePrefersReducedMotion } from "@/lib/motion";
import { useTheme } from "@/lib/store";
import { ENABLE_3D } from "@/lib/flags";

const Garden3D = dynamic(() => import("./Garden3D"), { ssr: false });

/**
 * Hashamatli botanika bog'i — FAQAT asosiy kontent paneli ortida.
 * Qatlamlar (orqadan oldinga), har biri har xil parallaks tezligida:
 *   1) uzoq fon — bog' yorug'ligi gradienti          (plx ×0.25)
 *   2) daraxt shox-shabbalari — katta xira yashillik  (plx ×0.4)
 *   3) quyosh nurlari + tuman                          (statik shimmer)
 *   4) barglar va novdalar — SVG, xira, chayqaladi     (plx ×0.75 → maks 6px)
 *   5) 3D qatlam (faqat ENABLE_3D) — uzoq gul + changcha
 *   6) markaz vualı — kontent doim o'qiladigan bo'lib qoladi
 * Barcha ranglar globals.css fon-qatlam tokenlaridan — mavzuga avtomatik
 * ergashadi. UI komponentlariga tegilmaydi; pointer-events yo'q.
 */

function Leaf({ size = 90, rotate = 0, flip = false }: { size?: number; rotate?: number; flip?: boolean }) {
  return (
    <svg
      width={size}
      height={size * 1.6}
      viewBox="0 0 60 96"
      fill="none"
      style={{ transform: `rotate(${rotate}deg) ${flip ? "scaleX(-1)" : ""}` }}
      aria-hidden
    >
      <path d="M30 92 C 8 68, 4 34, 30 4 C 56 34, 52 68, 30 92 Z" fill="var(--garden-leaf)" />
      <path d="M30 88 C 30 60, 30 34, 30 10" stroke="var(--garden-vein)" strokeWidth="1.6" strokeLinecap="round" />
      {[22, 38, 54, 68].map((y, i) => (
        <path key={y} d={`M30 ${y} C ${22 - i} ${y - 6}, ${16 - i} ${y - 8}, ${12 - i} ${y - 12}`} stroke="var(--garden-vein)" strokeWidth="1.1" strokeLinecap="round" />
      ))}
    </svg>
  );
}

function Branch({ width = 260, rotate = 0 }: { width?: number; rotate?: number }) {
  return (
    <svg width={width} height={width * 0.35} viewBox="0 0 200 70" fill="none" style={{ transform: `rotate(${rotate}deg)` }} aria-hidden>
      <path d="M2 64 C 60 52, 120 30, 198 6" stroke="var(--garden-branch)" strokeWidth="3" strokeLinecap="round" />
      <path d="M70 47 C 82 40, 90 32, 96 22" stroke="var(--garden-branch)" strokeWidth="2" strokeLinecap="round" />
      <path d="M130 30 C 140 26, 148 20, 154 12" stroke="var(--garden-branch)" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

export default function BotanicalGarden() {
  const { dark } = useTheme();
  const reduced = usePrefersReducedMotion();

  return (
    <div
      className="theme-fade pointer-events-none absolute inset-0 z-0 overflow-hidden"
      aria-hidden
      style={{ opacity: "var(--garden-op)" }}
    >
      {/* 1 — uzoq fon: bog' yorug'ligi (eng sekin qatlam) */}
      <div
        className="theme-fade absolute inset-0"
        style={{
          background: `linear-gradient(168deg,
            color-mix(in srgb, var(--glow-c) var(--gsky-1), transparent) 0%,
            color-mix(in srgb, #cfe4d4 var(--gsky-2), transparent) 42%,
            color-mix(in srgb, #adceb8 var(--gsky-3), transparent) 100%)`,
          transform: "translate3d(calc(var(--plx-x, 0px) * 0.25), calc(var(--plx-y, 0px) * 0.25), 0)",
        }}
      />

      {/* 2 — daraxt shox-shabbalari: katta, juda xira yashil massalar */}
      <div className="absolute inset-0" style={{ transform: "translate3d(calc(var(--plx-x, 0px) * 0.4), calc(var(--plx-y, 0px) * 0.4), 0)" }}>
        <div className="absolute -left-[18%] -top-[22%] h-[70vh] w-[60vw] rounded-full blur-[70px]"
          style={{ background: "radial-gradient(ellipse, var(--canopy-1), transparent 68%)", animation: reduced ? undefined : "gentleFloat 19s ease-in-out infinite" }} />
        <div className="absolute -right-[15%] -top-[12%] h-[56vh] w-[46vw] rounded-full blur-[80px]"
          style={{ background: "radial-gradient(ellipse, var(--canopy-2), transparent 66%)", animation: reduced ? undefined : "gentleFloat 23s ease-in-out infinite reverse" }} />
        <div className="absolute -bottom-[20%] left-[10%] h-[52vh] w-[70vw] rounded-full blur-[85px]"
          style={{ background: "radial-gradient(ellipse, var(--canopy-3), transparent 70%)", animation: reduced ? undefined : "glowPulse 17s ease-in-out infinite" }} />
      </div>

      {/* 3 — quyosh nurlari + tuman */}
      <div className="theme-fade absolute -top-[8%] left-[18%] h-[70vh] w-[16vw] -rotate-[18deg] blur-[36px]"
        style={{ background: "linear-gradient(180deg, var(--sun-ray-1), transparent 80%)", animation: reduced ? undefined : "glowPulse 13s ease-in-out infinite" }} />
      <div className="theme-fade absolute -top-[6%] left-[34%] h-[62vh] w-[9vw] -rotate-[14deg] blur-[30px]"
        style={{ background: "linear-gradient(180deg, var(--sun-ray-2), transparent 78%)", animation: reduced ? undefined : "glowPulse 16s ease-in-out infinite reverse" }} />
      <div className="fog-band theme-fade absolute left-[-30%] top-[30%] h-[30vh] w-[160%]"
        style={{ opacity: "calc(var(--fog-k, 0.32) * var(--fog-mg))" }} />

      {/* 4 — barglar va novdalar: xira, ohista chayqaladi (maks 6px parallaks) */}
      <div className="absolute inset-0" style={{ transform: "translate3d(calc(var(--plx-x, 0px) * 0.75), calc(var(--plx-y, 0px) * 0.75), 0)" }}>
        {/* yuqori-chap burchak premium piyonga berildi (PremiumPeony) — barg olib tashlandi */}
        <div className="absolute -left-4 top-[30%] blur-[13px]" style={{ transformOrigin: "bottom left", animation: reduced ? undefined : "leafSway 15s ease-in-out infinite reverse" }}>
          <Leaf size={82} rotate={62} />
        </div>
        <div className="absolute -right-6 top-[14%] blur-[10px]" style={{ transformOrigin: "bottom right", animation: reduced ? undefined : "leafSway 13.5s ease-in-out infinite" }}>
          <Leaf size={96} rotate={-42} flip />
        </div>
        <div className="absolute -right-10 top-[46%] blur-[15px]" style={{ transformOrigin: "bottom right", animation: reduced ? undefined : "leafSway 17s ease-in-out infinite reverse" }}>
          <Leaf size={120} rotate={-64} flip />
        </div>
        <div className="absolute -bottom-6 left-[16%] blur-[12px]" style={{ transformOrigin: "bottom center", animation: reduced ? undefined : "leafSway 14s ease-in-out infinite" }}>
          <Leaf size={88} rotate={-8} />
        </div>
        <div className="absolute bottom-[4%] right-[22%] blur-[14px]" style={{ transformOrigin: "bottom center", animation: reduced ? undefined : "leafSway 16.5s ease-in-out infinite reverse" }}>
          <Leaf size={74} rotate={14} flip />
        </div>
        <div className="absolute -right-16 bottom-[10%] blur-[13px]" style={{ animation: reduced ? undefined : "leafSway 20s ease-in-out infinite reverse" }}>
          <Branch width={260} rotate={-158} />
        </div>
      </div>

      {/* 5 — 3D qatlam: faqat bayroq yoqilganda (chunk aks holda yuklanmaydi) */}
      {ENABLE_3D && <Garden3D dark={dark} reduced={reduced} />}

      {/* 6 — markaz vualı: kontent zonasi doim tinch va o'qiladigan */}
      <div
        className="absolute inset-0"
        style={{
          background: `radial-gradient(ellipse 70% 62% at 50% 42%, color-mix(in srgb, var(--bg) var(--veil-k), transparent), transparent 78%)`,
        }}
      />

      <style jsx>{`
        @keyframes leafSway {
          0%, 100% { rotate: 0deg; }
          50% { rotate: 3.5deg; }
        }
      `}</style>
    </div>
  );
}
