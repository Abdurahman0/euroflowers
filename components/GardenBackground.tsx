"use client";
import { useEffect, useRef, useState } from "react";
import { useStore } from "@/lib/store";
import { gardenRef } from "@/lib/garden";

const VIDEO = "/crm-garden-bg.mp4";
const POSTER = "/crm-garden-bg.webp";

/**
 * Global fon: Ghibli bog' videosi (uzluksiz sikl, ovoz bilan — sukutda mute)
 * + tema-ga mos o'qiluvchanlik pardasi. HAMMA sahifalar ortida turadi.
 *
 * Himoya rejimi (video umuman yuklanmaydi, faqat webp poster):
 *   mobil (<768px) · saveData/2g · deviceMemory ≤ 4 · prefers-reduced-motion
 */
export default function GardenBackground({ active = true }: { active?: boolean }) {
  const setGardenPosterOnly = useStore((s) => s.setGardenPosterOnly);
  const videoRef = useRef<HTMLVideoElement>(null);
  // null = hali aniqlanmagan (SSR/birinchi renderda hech narsa yuklamaymiz)
  const [allowVideo, setAllowVideo] = useState<boolean | null>(null);

  useEffect(() => {
    type NetInfo = { saveData?: boolean; effectiveType?: string };
    const conn = (navigator as Navigator & { connection?: NetInfo }).connection;
    const mem = (navigator as Navigator & { deviceMemory?: number }).deviceMemory;
    const blocked =
      window.innerWidth < 768 ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches ||
      conn?.saveData === true ||
      conn?.effectiveType === "2g" ||
      conn?.effectiveType === "slow-2g" ||
      (typeof mem === "number" && mem <= 4);
    setAllowVideo(!blocked);
    setGardenPosterOnly(blocked);
  }, [setGardenPosterOnly]);

  // birinchi bo'yashdan KEYIN yuklab ijro etamiz — LCP'ga xalaqit yo'q
  useEffect(() => {
    if (!allowVideo) return;
    const el = videoRef.current;
    if (!el) return;
    gardenRef.el = el;
    const start = () => {
      el.load();
      el.play().catch(() => { /* autoplay bloklansa poster ko'rinadi */ });
    };
    const id = window.requestIdleCallback ? window.requestIdleCallback(start) : window.setTimeout(start, 150);

    // yashirin tabda pauza — batareya/dekoder tejaladi
    const onVis = () => {
      if (document.hidden) el.pause();
      else el.play().catch(() => {});
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      if (window.cancelIdleCallback && typeof id === "number") window.cancelIdleCallback(id);
      else clearTimeout(id as number);
      gardenRef.el = null;
    };
  }, [allowVideo]);

  return (
    // rejim almashganda 400ms yumshoq krossfeyd — layout siljimaydi
    <div className="transition-opacity duration-[400ms] ease-out" style={{ opacity: active ? 1 : 0 }}>
      {/* 1) video / poster — eng pastki qatlam */}
      <div className="pointer-events-none fixed inset-0 z-0" aria-hidden>
        {allowVideo === true && (
          <video
            ref={videoRef}
            muted
            loop
            playsInline
            preload="none"
            poster={POSTER}
            className="h-full w-full object-cover"
            style={{ objectPosition: "center" }}
          >
            <source src={VIDEO} type="video/mp4" />
          </video>
        )}
        {allowVideo === false && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={POSTER} alt="" className="h-full w-full object-cover" style={{ objectPosition: "center" }} />
        )}
      </div>

      {/* parda YO'Q — kuchaytirilgan video to'liq tiniqlikda; o'qiluvchanlikni
           UI yuzalarining o'z fonlari ta'minlaydi */}
    </div>
  );
}
