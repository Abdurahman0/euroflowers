"use client";
import { useEffect, useState } from "react";
import { useReducedMotion } from "@/hooks/useReducedMotion";

const VIDEO = "/login-scene.mp4";
export const POSTER = "/login-scene-poster.jpg";

/**
 * Ghibli uslubidagi piyon video-panel.
 *   • autoplay+muted+playsinline+loop — iOS Safari bilan barcha brauzerlarda ishlaydi
 *   • poster darhol ko'rinadi — bo'sh joy "yaltirashi" yo'q
 *   • prefers-reduced-motion yoki saveData → faqat poster
 *   • o'ng chekka gradienti forma paneli rangiga "erib" ketadi — chok yo'q
 */
export default function LoginVideo({ meltColor = "#FAF6F2" }: { meltColor?: string }) {
  const reduced = useReducedMotion();
  const [staticOnly, setStaticOnly] = useState(false);

  useEffect(() => {
    type NetInfo = { saveData?: boolean; effectiveType?: string };
    const conn = (navigator as Navigator & { connection?: NetInfo }).connection;
    if (conn?.saveData || conn?.effectiveType === "2g" || conn?.effectiveType === "slow-2g") {
      setStaticOnly(true);
    }
  }, []);

  const media = reduced || staticOnly ? (
    <img
      src={POSTER}
      alt=""
      aria-hidden
      className="h-full w-full object-cover"
      style={{ objectPosition: "left center" }}
    />
  ) : (
    <video
      autoPlay
      muted
      loop
      playsInline
      preload="auto"
      poster={POSTER}
      aria-hidden="true"
      className="pointer-events-none h-full w-full object-cover"
      style={{ objectPosition: "left center" }}
    >
      <source src={VIDEO} type="video/mp4" />
    </video>
  );

  return (
    <div className="relative h-full w-full overflow-hidden" aria-hidden>
      {media}
      {/* o'ng chekka — forma fоniga eritish, chok yo'q */}
      <div
        className="pointer-events-none absolute inset-y-0 right-0 w-[38%]"
        style={{ background: `linear-gradient(90deg, transparent, ${meltColor})` }}
      />
      {/* juda yengil pastki vinyetka — video chuqurroq his etiladi */}
      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 h-[18%]"
        style={{ background: "linear-gradient(180deg, transparent, rgba(60,40,32,0.12))" }}
      />
    </div>
  );
}
