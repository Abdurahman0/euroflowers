"use client";
import dynamic from "next/dynamic";

const LoadingFlower = dynamic(() => import("./three/LoadingFlower"), {
  ssr: false,
  // GLB hali yo'lda — yumshoq nafas oluvchi nur (spinner emas)
  loading: () => (
    <div className="flex h-full w-full items-center justify-center">
      <span
        className="block h-16 w-16 rounded-full blur-xl"
        style={{ background: "var(--accL)", animation: "glowPulse 2.6s ease-in-out infinite" }}
      />
    </div>
  ),
});

/**
 * Yuklanish holati: Blender'dan eksport qilingan haqiqiy piyon
 * g'uncha → ochilish → gullash → yopilish siklini ijro etadi.
 * Gulning o'zi — yuklanish indikatori.
 */
export default function FlowerLoader({ label = "Yuklanmoqda…" }: { label?: string }) {
  return (
    <div className="mt-8 flex flex-col items-center gap-1" role="status" aria-label={label}>
      <div className="h-[210px] w-[190px]">
        <LoadingFlower />
      </div>
      <span className="text-[13px] font-medium" style={{ color: "var(--mut)" }}>{label}</span>
    </div>
  );
}
