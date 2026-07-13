"use client";

/** Bo'sh holat — nozik gul chizmasi bilan, quruq matn o'rniga. */
export default function EmptyState({ title, sub }: { title: string; sub?: string }) {
  return (
    <div className="flex flex-col items-center gap-2.5 px-5 py-9 text-center">
      <svg width="64" height="72" viewBox="0 0 64 72" fill="none" aria-hidden className="opacity-55">
        <path d="M32 68 C 31 56, 33 48, 32 38" stroke="var(--mintink, #3d6b52)" strokeWidth="1.8" strokeLinecap="round" />
        <path d="M32 54 C 25 52, 21 47, 22 43 C 27 44, 31 48, 32 54 Z" fill="var(--mintink, #3d6b52)" opacity="0.55" />
        {[0, 60, 120, 180, 240, 300].map((deg) => (
          <ellipse key={deg} cx="32" cy="26" rx="5.5" ry="10" fill="var(--accL)" opacity="0.8"
            style={{ transformOrigin: "32px 32px", transform: `rotate(${deg}deg)` }} />
        ))}
        <circle cx="32" cy="32" r="4.5" fill="var(--acc)" opacity="0.85" />
      </svg>
      <p className="text-[13.5px] font-bold" style={{ color: "var(--ink)" }}>{title}</p>
      {sub && <p className="max-w-[300px] text-[12.5px] leading-relaxed" style={{ color: "var(--mut)" }}>{sub}</p>}
    </div>
  );
}
