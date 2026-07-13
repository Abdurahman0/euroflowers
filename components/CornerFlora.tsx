"use client";

/**
 * Burchak gullari — juda sekin nafas oladigan nozik piyon silueti.
 * Sahifa hech qachon to'liq to'xtab qolmaydi, lekin ko'zga tashlanmaydi.
 */
function Peony({ size = 150 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" fill="none" aria-hidden>
      {/* tashqi gulbarglar */}
      {[0, 60, 120, 180, 240, 300].map((deg) => (
        <path
          key={deg}
          d="M50 50 C 38 34, 42 16, 50 10 C 58 16, 62 34, 50 50 Z"
          fill="var(--acc)"
          opacity="0.5"
          transform={`rotate(${deg} 50 50)`}
        />
      ))}
      {/* ichki gulbarglar */}
      {[30, 90, 150, 210, 270, 330].map((deg) => (
        <path
          key={deg}
          d="M50 50 C 42 39, 44 26, 50 21 C 56 26, 58 39, 50 50 Z"
          fill="var(--accL)"
          opacity="0.65"
          transform={`rotate(${deg} 50 50)`}
        />
      ))}
      <circle cx="50" cy="50" r="6.5" fill="var(--acc)" opacity="0.8" />
      <circle cx="50" cy="50" r="3" fill="#f0dfae" opacity="0.9" />
    </svg>
  );
}

export default function CornerFlora() {
  return (
    <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden" aria-hidden>
      <div
        className="absolute -right-10 -top-10 opacity-[.13]"
        style={{ animation: "floraBreath 13s ease-in-out infinite" }}
      >
        <Peony size={190} />
      </div>
      <div
        className="absolute -bottom-14 -left-12 opacity-[.11]"
        style={{ animation: "floraBreath 17s ease-in-out infinite reverse" }}
      >
        <Peony size={230} />
      </div>
      <style jsx>{`
        @keyframes floraBreath {
          0%, 100% { transform: scale(1) rotate(0deg); }
          50% { transform: scale(1.06) rotate(4deg); }
        }
      `}</style>
    </div>
  );
}
