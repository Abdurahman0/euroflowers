"use client";
import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { usePrefersReducedMotion } from "@/lib/motion";
import { useStore, useTheme } from "@/lib/store";
import { ENABLE_3D } from "@/lib/flags";
import { isLowEnd } from "@/lib/perf";
import BackgroundFlowers from "@/components/BackgroundFlowers";
import FallingPetals from "@/components/FallingPetals";

const Ambient3D = dynamic(() => import("./Ambient3D"), { ssr: false });

/**
 * Ilova foni — qatlamma-qatlam chuqurlik (orqadan oldinga):
 *   1) osmon: tirik gradientlar (CSS, mavzu tokenlaridan)
 *   2) yumshoq tuman (--fog-k · --fog-m1/m2)
 *   3) barg-soyalar + katta haqiqiy gul suratlari (DOM parallaks)
 *   4) 3D (faqat ENABLE_3D): Blender gulbarglari + changcha
 * Barcha ranglar globals.css'dagi fon-qatlam tokenlaridan olinadi —
 * mavzu almashganda hammasi birga, 600ms yumshoqlik bilan moslashadi.
 */
export default function FlowerBackground() {
  const { dark } = useTheme();
  const bgMode = useStore((s) => s.bgMode);
  const reduced = usePrefersReducedMotion();
  const [petals, setPetals] = useState(28);
  useEffect(() => {
    if (isLowEnd()) setPetals(16);
  }, []);

  return (
    <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden" aria-hidden>
      {/* RASM rejimi qatlamlari: osmon gradienti, nur dog'lari, tuman, gul
          suratlari — VIDEO rejimda BUTUNLAY yashirinadi (hech qanday to'liq
          ekranli yuvish video ranglarini buzmasligi kerak) */}
      <div
        className="transition-opacity duration-[400ms] ease-out"
        style={{ opacity: bgMode === "rasm" ? 1 : 0 }}
      >
        {/* 1-qatlam: osmon — mavzu gradientlari (eng sekin qatlam) */}
        <div
          className="theme-fade absolute inset-0"
          style={{
            background: `linear-gradient(180deg, color-mix(in srgb, var(--glow-c) var(--sky-k), transparent), transparent 55%)`,
            transform: "translate3d(calc(var(--plx-x, 0px) * 1), calc(var(--plx-y, 0px) * 1), 0)",
          }}
        />
        <div
          className="absolute -left-[15%] top-[-10%] h-[55vh] w-[55vh] rounded-full blur-[70px]"
          style={{
            background: `radial-gradient(circle, color-mix(in srgb, var(--glow-a) var(--glow-a-k), transparent), transparent 70%)`,
            animation: reduced ? undefined : "gentleFloat 11s ease-in-out infinite",
          }}
        />
        <div
          className="theme-fade absolute right-[-10%] top-[35%] h-[48vh] w-[48vh] rounded-full blur-[80px]"
          style={{
            background: `radial-gradient(circle, var(--glow-warm), transparent 70%)`,
            opacity: "var(--glow-warm-op)",
            animation: reduced ? undefined : "gentleFloat 14s ease-in-out infinite reverse",
          }}
        />
        <div
          className="absolute bottom-[-12%] left-[28%] h-[50vh] w-[50vh] rounded-full blur-[75px]"
          style={{
            background: `radial-gradient(circle, color-mix(in srgb, var(--glow-c) var(--glow-c-k), transparent), transparent 68%)`,
            animation: reduced ? undefined : "glowPulse 9s ease-in-out infinite",
          }}
        />

        {/* 2-qatlam: yumshoq tuman — sekin oqadi */}
        <div
          className="fog-band theme-fade absolute left-[-30%] top-[22%] h-[34vh] w-[160%]"
          style={{ opacity: "calc(var(--fog-k, 0.32) * var(--fog-m1))" }}
        />
        <div
          className="fog-band fog-band-2 theme-fade absolute bottom-[8%] left-[-30%] h-[28vh] w-[160%]"
          style={{ opacity: "calc(var(--fog-k, 0.32) * var(--fog-m2))" }}
        />

        {/* 3-qatlam: pastki gidrangealar + o'ng-yuqori piyon (fon suratlari) */}
        <BackgroundFlowers />
      </div>

      {/* 3.5-qatlam: yuqoridan tushayotgan gulbarglar (DOM, arzon) */}
      <FallingPetals />

      {/* 4-qatlam: 3D — faqat bayroq yoqilganda; chunk aks holda yuklanmaydi */}
      {ENABLE_3D && <Ambient3D dark={dark} reduced={reduced} petals={petals} />}
    </div>
  );
}
