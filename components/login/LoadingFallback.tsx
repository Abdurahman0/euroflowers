"use client";

/** GLB yuklanayotgandagi holat — spinner emas, nafas oluvchi yumshoq nur. */
export default function LoadingFallback() {
  return (
    <div className="flex h-full w-full items-center justify-center" aria-hidden>
      <span
        className="block h-20 w-20 rounded-full blur-2xl"
        style={{
          background: "color-mix(in srgb, var(--accL, #e9c6c0) 70%, transparent)",
          animation: "glowPulse 2.4s ease-in-out infinite",
        }}
      />
    </div>
  );
}
