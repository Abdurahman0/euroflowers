"use client";

/**
 * Yuklanish holati: urug' → nihol → poya → gul ochilishi (sikl).
 * SVG + CSS — 3D'siz, hamma joyda ishlatsa bo'ladigan yengil loader.
 */
export default function FlowerLoader({ label = "Yuklanmoqda…" }: { label?: string }) {
  return (
    <div className="mt-10 flex flex-col items-center gap-3" role="status" aria-label={label}>
      <svg width="72" height="96" viewBox="0 0 72 96" fill="none" aria-hidden>
        {/* urug' */}
        <ellipse className="fl-seed" cx="36" cy="86" rx="5" ry="4" fill="var(--tintink)" opacity="0.7" />
        {/* poya o'sadi */}
        <path
          className="fl-stem"
          d="M36 86 C 35 70, 38 58, 36 40"
          stroke="var(--mintink, #3d6b52)"
          strokeWidth="2.6"
          strokeLinecap="round"
          pathLength="1"
        />
        {/* barglar */}
        <path className="fl-leaf fl-leaf-1" d="M36 64 C 28 62, 24 56, 25 51 C 31 52, 35 57, 36 64 Z" fill="var(--mintink, #3d6b52)" opacity="0.85" />
        <path className="fl-leaf fl-leaf-2" d="M36 55 C 44 53, 48 47, 47 42 C 41 43, 37 48, 36 55 Z" fill="var(--mintink, #3d6b52)" opacity="0.75" />
        {/* gulbarglar — markazdan ochiladi */}
        <g className="fl-head">
          {[0, 60, 120, 180, 240, 300].map((deg, i) => (
            <ellipse
              key={deg}
              className="fl-petal"
              style={{ animationDelay: `${1.05 + i * 0.09}s`, transformOrigin: "36px 40px", rotate: `${deg}deg` }}
              cx="36"
              cy="30"
              rx="7"
              ry="11.5"
              fill="var(--acc)"
              opacity="0.9"
            />
          ))}
          <circle className="fl-center" cx="36" cy="40" r="5.5" fill="var(--accL)" />
        </g>
      </svg>
      <span className="text-[13px] font-medium" style={{ color: "var(--mut)" }}>{label}</span>

      <style jsx>{`
        .fl-seed {
          animation: seedPulse 3.2s ease-in-out infinite;
        }
        .fl-stem {
          stroke-dasharray: 1;
          stroke-dashoffset: 1;
          animation: stemGrow 3.2s ease-out infinite;
        }
        .fl-leaf {
          transform-origin: 36px 60px;
          animation: leafIn 3.2s ease-out infinite;
        }
        .fl-leaf-2 {
          animation-delay: 0.15s;
        }
        .fl-petal {
          animation: petalOpen 3.2s cubic-bezier(0.22, 1, 0.36, 1) infinite;
        }
        .fl-center {
          animation: centerIn 3.2s ease-out infinite;
        }
        @keyframes seedPulse {
          0%, 8% { transform: scale(0.7); opacity: 0.4; }
          16%, 100% { transform: scale(1); opacity: 0.7; }
        }
        @keyframes stemGrow {
          0%, 10% { stroke-dashoffset: 1; }
          42%, 100% { stroke-dashoffset: 0; }
        }
        @keyframes leafIn {
          0%, 30% { transform: scale(0); }
          52%, 100% { transform: scale(1); }
        }
        @keyframes petalOpen {
          0%, 33% { transform: scale(0); opacity: 0; }
          58% { opacity: 0.9; }
          62%, 88% { transform: scale(1); opacity: 0.9; }
          100% { transform: scale(1.04); opacity: 0.85; }
        }
        @keyframes centerIn {
          0%, 40% { transform: scale(0); transform-origin: 36px 40px; }
          62%, 100% { transform: scale(1); transform-origin: 36px 40px; }
        }
      `}</style>
    </div>
  );
}
