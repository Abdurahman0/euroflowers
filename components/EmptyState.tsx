"use client";

/** Bo'sh holat — haqiqiy piyon surati bilan, quruq matn o'rniga. */
export default function EmptyState({ title, sub }: { title: string; sub?: string }) {
  return (
    <div className="flex flex-col items-center gap-2.5 px-5 py-9 text-center">
      <img
        src="/flowers/textures/peony.png"
        alt=""
        aria-hidden
        width={86}
        height={86}
        className="opacity-70"
        style={{
          filter: "saturate(0.85) drop-shadow(0 10px 22px rgba(140,80,70,0.25))",
          animation: "gentleFloat 7s ease-in-out infinite",
        }}
      />
      <p className="text-[13.5px] font-bold" style={{ color: "var(--ink)" }}>{title}</p>
      {sub && <p className="max-w-[300px] text-[12.5px] leading-relaxed" style={{ color: "var(--mut)" }}>{sub}</p>}
    </div>
  );
}
