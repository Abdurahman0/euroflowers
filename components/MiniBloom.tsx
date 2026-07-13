"use client";

/**
 * KPI karta burchagidagi mitti gul — karta hover bo'lganda gulbarglari ochiladi.
 * Ota element `group` klassiga ega bo'lishi kerak.
 */
export default function MiniBloom() {
  return (
    <span className="mini-bloom pointer-events-none absolute bottom-2.5 right-3 block h-7 w-7 opacity-40 transition-opacity duration-500 group-hover:opacity-90" aria-hidden>
      <svg viewBox="0 0 40 40" width="100%" height="100%">
        {[0, 72, 144, 216, 288].map((deg, i) => (
          <ellipse
            key={deg}
            className="mb-petal"
            cx="20"
            cy="13"
            rx="4.5"
            ry="8"
            fill="currentColor"
            opacity="0.75"
            style={{ transformOrigin: "20px 20px", rotate: `${deg}deg`, transitionDelay: `${i * 55}ms` }}
          />
        ))}
        <circle cx="20" cy="20" r="3.4" fill="currentColor" />
      </svg>
      <style jsx>{`
        .mb-petal {
          scale: 0.35;
          transition: scale 0.7s cubic-bezier(0.22, 1, 0.36, 1);
        }
        :global(.group:hover) .mb-petal {
          scale: 1;
        }
      `}</style>
    </span>
  );
}
