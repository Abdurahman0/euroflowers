"use client";
import { FLOWER_PHOTOS } from "@/components/three/engine/assets";

/**
 * KPI karta burchagidagi mitti gul — haqiqiy piyon surati, karta hover
 * bo'lganda ohista "ochiladi" (kichikdan to'liq o'lchamga aylanib chiqadi).
 * Ota element `group` klassiga ega bo'lishi kerak.
 */
export default function MiniBloom() {
  return (
    <span className="mini-bloom pointer-events-none absolute bottom-2.5 right-3 block h-8 w-8 opacity-45 transition-opacity duration-500 group-hover:opacity-95" aria-hidden>
      <img src={FLOWER_PHOTOS.peony} alt="" width={32} height={32} className="mb-img h-full w-full object-contain" />
      <style jsx>{`
        .mb-img {
          scale: 0.45;
          rotate: -40deg;
          transition: scale 0.7s cubic-bezier(0.22, 1, 0.36, 1), rotate 0.7s cubic-bezier(0.22, 1, 0.36, 1);
          filter: saturate(0.9);
        }
        :global(.group:hover) .mb-img {
          scale: 1;
          rotate: 0deg;
        }
      `}</style>
    </span>
  );
}
